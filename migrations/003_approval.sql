-- 003: salon approval on the hosted instance (against spam and SMS costs).
-- A salon from "Załóż salon" waits as 'pending' until the platform admin accepts it. Old rows stay 'active'.
alter table salon
  add column status text not null default 'active' check (status in ('pending', 'active', 'rejected')),
  add column city text not null default '',
  add column street text not null default '',
  add column team_size text check (team_size in ('1', '2–3', '4–6', '7+')),
  add column link text not null default '',
  add column about text not null default '',
  add column signup_ip text,
  add column submitted_at timestamptz,
  add column decided_at timestamptz,
  add column reject_reason text not null default '';

-- One salon per phone number (the demo salon is not counted).
create unique index salon_phone_once on salon (phone) where not is_demo and phone is not null;
create index salon_status on salon (status, submitted_at);
create index salon_signup_ip on salon (signup_ip, created_at);

-- What the platform admin did. No foreign key: the row keeps slug and name after the purge.
create table admin_audit (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid,
  salon_slug text not null,
  salon_name text not null,
  action text not null check (action in ('accept', 'reject', 'purge')),
  reason text not null default '',
  ip text,
  created_at timestamptz not null default now()
);
create index admin_audit_time on admin_audit (created_at desc);

-- Platform admin sessions. id = sha256 of the cookie token.
create table admin_session (
  id text primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
