// GET ?since=ISO&until=ISO: SMS counter of the salon (default: this month), manager only.
// The panel sends the month from the browser clock. limit = SMS_MONTHLY_LIMIT (the hosted package).
import { q, staffApi } from '$lib/server/http.ts';
import { env } from '$lib/server/env.ts';
import { forbidden } from '$lib/server/errors.ts';
import { smsCounter } from '$lib/server/notify.ts';
import { can } from '$lib/server/policy.ts';

export const GET = staffApi(async (c, actor) => {
  if (!can(actor, 'notification:read', { salonId: c.salon.id })) throw forbidden();
  const first = Temporal.Now.plainDateISO(c.salon.timezone).with({ day: 1 });
  const since = q(c, 'since') ?? first.toZonedDateTime({ timeZone: c.salon.timezone }).toInstant().toString();
  const until = q(c, 'until');
  const limit = Number(env('SMS_MONTHLY_LIMIT', '300')) || 300;
  return { since, until: until ?? null, limit, ...(await smsCounter(c.sql, c.salon.id, since, until)) };
});
