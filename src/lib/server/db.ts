import postgres, { type Sql } from 'postgres';
import { databaseUrl } from './env.ts';

export type Db = Sql;

let current: Sql | null = null;

export function connect(url = databaseUrl(), max = 10): Sql {
  return postgres(url, {
    max,
    // A stopped database must fail fast (/health gives 503), not hang a request.
    connect_timeout: 3,
    onnotice: () => {},
    connection: { TimeZone: 'UTC', application_name: 'beauty' }
  });
}

/** The process-wide pool. Tests may swap it with useDb(). */
export function db(): Sql {
  if (!current) current = connect();
  return current;
}

export function useDb(sql: Sql | null): void {
  current = sql;
}

export async function closeDb(): Promise<void> {
  if (current) await current.end({ timeout: 5 });
  current = null;
}

/** Postgres error code of a thrown error, or undefined. */
export function pgCode(e: unknown): string | undefined {
  return typeof e === 'object' && e !== null && 'code' in e
    ? String((e as { code: unknown }).code)
    : undefined;
}

/** Run fn in a transaction; inside an open transaction it runs in that one. */
export async function inTx<T>(sql: Sql, fn: (tx: Sql) => Promise<T>): Promise<T> {
  if ('savepoint' in sql) return fn(sql);
  return sql.begin((tx) => fn(tx as unknown as Sql)) as Promise<T>;
}

/**
 * Run a write that an exclusion constraint guards. Two concurrent inserts that conflict can make Postgres
 * abort one with a deadlock (40P01) instead of 23P01; a retry then sees the committed row and gets 23P01.
 */
export async function retryDeadlock<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (pgCode(e) !== '40P01' || i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 10 + Math.random() * 40));
    }
  }
}
