-- 004: the client booking page, SMS limits, reminders from a sweep, RODO erase.

-- The client may cancel from the SMS link until this many hours before the visit.
alter table salon
  add column cancel_cutoff_hours int not null default 2 check (cancel_cutoff_hours between 0 and 72);

-- RODO: an erased client keeps her row (visits keep time and service) but loses name, phone and note.
alter table client add column erased_at timestamptz;

-- 'limit' = the salon used its monthly SMS package: the row is written, nothing is sent.
alter table notification drop constraint notification_status_check;
alter table notification
  add constraint notification_status_check check (status in ('queued', 'logged', 'sent', 'failed', 'limit'));

-- The reminder sweep runs every 10 minutes: each reminder goes out once per visit (and per manager).
create unique index notification_once on notification (visit_id, type, staff_id) nulls not distinct
  where type in ('przypomnienie', 'menadzerka') and visit_id is not null;

-- The monthly counter and the sweep read by salon and type.
create index notification_visit on notification (salon_id, visit_id, type);
