import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Sql } from 'postgres';

/** Runs every migrations/NNN_*.sql file that is not in schema_migrations yet, each in one transaction. */
export async function migrate(sql: Sql, dir: string, log: (m: string) => void = () => {}): Promise<string[]> {
  await sql`create table if not exists schema_migrations (
    name text primary key, applied_at timestamptz not null default now())`;
  const files = (await readdir(dir)).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();
  const done = new Set(
    (await sql<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name)
  );
  const applied: string[] = [];
  for (const f of files) {
    if (done.has(f)) continue;
    const text = await readFile(join(dir, f), 'utf8');
    await sql.begin(async (tx) => {
      await tx.unsafe(text);
      await tx`insert into schema_migrations (name) values (${f})`;
    });
    applied.push(f);
    log(`migration ${f} applied`);
  }
  return applied;
}
