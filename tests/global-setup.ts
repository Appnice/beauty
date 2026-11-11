// Creates a fresh test database on the local Postgres (127.0.0.1:55440) and applies the migrations.
import { join } from 'node:path';
import postgres from 'postgres';
import { migrate } from '../src/lib/server/migrate.ts';

export default async function setup() {
  const url = new URL(
    process.env.TEST_DATABASE_URL ?? 'postgres://beauty:beauty@127.0.0.1:55440/beauty_test'
  );
  const name = url.pathname.slice(1);
  if (!/^[a-z_][a-z0-9_]*$/.test(name) || !name.includes('test'))
    throw new Error(`refusing test db name ${name}`);
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const a = postgres(admin.toString(), { max: 1, onnotice: () => {} });
  try {
    await a.unsafe(`drop database if exists ${name} with (force)`);
    await a.unsafe(`create database ${name}`);
  } catch (e) {
    throw new Error(`Cannot reach the test Postgres at ${admin.host}. Run "make db" first.`, { cause: e });
  } finally {
    await a.end();
  }
  const sql = postgres(url.toString(), { max: 1, onnotice: () => {} });
  try {
    await migrate(sql, join(import.meta.dirname, '..', 'migrations'));
  } finally {
    await sql.end();
  }
}
