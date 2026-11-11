// npm run seed: create or re-create the demo salon (slug "demo") around today.
import { connect } from '../src/lib/server/db.ts';
import { seedDemo } from '../src/lib/server/seed.ts';

const sql = connect(undefined, 2);
try {
  const r = await seedDemo(sql);
  const [s] = await sql<{ staff: number; services: number }[]>`
    select (select count(*)::int from staff where salon_id = ${r.salon.id} and role = 'stylist') as staff,
           (select count(*)::int from service where salon_id = ${r.salon.id}) as services`;
  console.log(
    `seed: salon "${r.salon.name}" (/${r.salon.slug}): ${s.staff} stylists, ${s.services} services, ` +
      `${r.clients} clients, ${r.visits} visits; manager login +48 500 000 001`
  );
} finally {
  await sql.end();
}
