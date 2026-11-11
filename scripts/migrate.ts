// npm run migrate: apply migrations/NNN_*.sql to DATABASE_URL.
import { join } from 'node:path';
import { connect } from '../src/lib/server/db.ts';
import { migrate } from '../src/lib/server/migrate.ts';

const sql = connect(undefined, 1);
try {
  const applied = await migrate(sql, join(import.meta.dirname, '..', 'migrations'), (m) => console.log(m));
  console.log(applied.length ? `migrate: ${applied.length} applied` : 'migrate: up to date');
} finally {
  await sql.end();
}
