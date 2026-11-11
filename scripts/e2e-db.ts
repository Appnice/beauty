// make e2e: a fresh database beauty_e2e on the local Postgres, with the migrations and the demo salon.
import { join } from 'node:path';
import postgres from 'postgres';
import { migrate } from '../src/lib/server/migrate.ts';
import { seedDemo } from '../src/lib/server/seed.ts';
import { connect } from '../src/lib/server/db.ts';

const url = new URL(process.env.E2E_DATABASE_URL ?? 'postgres://beauty:beauty@127.0.0.1:55440/beauty_e2e');
const name = url.pathname.slice(1);
if (!/^[a-z_][a-z0-9_]*$/.test(name) || !name.includes('e2e'))
  throw new Error(`refusing e2e db name ${name}`);
const admin = new URL(url);
admin.pathname = '/postgres';
const a = postgres(admin.toString(), { max: 1, onnotice: () => {} });
await a.unsafe(`drop database if exists ${name} with (force)`);
await a.unsafe(`create database ${name}`);
await a.end();
const sql = connect(url.toString(), 2);
try {
  await migrate(sql, join(import.meta.dirname, '..', 'migrations'));
  await seedDemo(sql);
  console.log(`e2e: fresh database ${name}`);
} finally {
  await sql.end();
}
