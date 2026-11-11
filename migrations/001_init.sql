-- 001: core data model. Every row belongs to one salon (salon_id).
-- Composite foreign keys (salon_id, id) stop a row from pointing at a row of another salon.

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

create table salon (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'),
  host text unique,                          -- optional custom domain or subdomain, later
  name text not null,
  address text not null default '',
  phone text,
  timezone text not null default 'Europe/Warsaw',
  confirmation_mode text not null default 'auto' check (confirmation_mode in ('auto', 'manual')),
  manager_reminder_hours int not null default 2 check (manager_reminder_hours between 1 and 72),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

-- Opening hours of the salon. weekday: ISO 1 = Monday .. 7 = Sunday. No row = closed that day.
create table opening_hours (
  salon_id uuid not null references salon (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  opens time not null,
  closes time not null check (closes > opens),
  primary key (salon_id, weekday)
);

create table staff (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salon (id) on delete cascade,
  name text not null,
  role text not null check (role in ('manager', 'stylist')),
  phone text not null check (phone ~ '^\+[0-9]{8,15}$'),
  color text not null default '#B5838D',
  password_hash text,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (salon_id, id),
  unique (salon_id, phone)
);

create table service (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salon (id) on delete cascade,
  name text not null,
  duration_min int not null check (duration_min between 5 and 720),
  price_grosze int check (price_grosze >= 0),
  buffer_min int not null default 0 check (buffer_min between 0 and 120),
  active boolean not null default true,
  sort int not null default 0,
  unique (salon_id, id)
);

-- Who does what, with an optional own duration.
create table staff_service (
  salon_id uuid not null,
  staff_id uuid not null,
  service_id uuid not null,
  duration_min int check (duration_min between 5 and 720),
  primary key (staff_id, service_id),
  foreign key (salon_id, staff_id) references staff (salon_id, id) on delete cascade,
  foreign key (salon_id, service_id) references service (salon_id, id) on delete cascade
);

-- Fixed weekly working hours of a stylist (several rows per day allowed).
create table schedule (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null,
  staff_id uuid not null,
  weekday smallint not null check (weekday between 1 and 7),
  starts time not null,
  ends time not null check (ends > starts),
  foreign key (salon_id, staff_id) references staff (salon_id, id) on delete cascade
);
create index schedule_staff on schedule (salon_id, staff_id, weekday);

-- Leave, break, training.
create table block (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null,
  staff_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  reason text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  foreign key (salon_id, staff_id) references staff (salon_id, id) on delete cascade
);
create index block_staff_time on block using gist (salon_id, staff_id, tstzrange(starts_at, ends_at));

create table client (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salon (id) on delete cascade,
  name text not null,
  phone text check (phone ~ '^\+[0-9]{8,15}$'),
  phone_verified_at timestamptz,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (salon_id, id),
  unique (salon_id, phone)
);

-- A visit. `during` = [start, end + buffer after the service). Status codes are ASCII:
-- oczekuje, potwierdzona, odwolana, nieobecnosc, zakonczona.
create table visit (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null,
  client_id uuid not null,
  staff_id uuid not null,
  service_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  blocked_until timestamptz not null,
  during tstzrange generated always as (tstzrange(starts_at, blocked_until, '[)')) stored,
  status text not null check (status in ('oczekuje', 'potwierdzona', 'odwolana', 'nieobecnosc', 'zakonczona')),
  source text not null check (source in ('online', 'recepcja')),
  price_grosze int,
  note text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by text check (cancelled_by in ('klient', 'salon')),
  check (ends_at > starts_at and blocked_until >= ends_at),
  unique (salon_id, id),
  foreign key (salon_id, client_id) references client (salon_id, id) on delete cascade,
  foreign key (salon_id, staff_id) references staff (salon_id, id) on delete cascade,
  foreign key (salon_id, service_id) references service (salon_id, id) on delete cascade,
  -- The guard against double booking: no two active visits of one stylist may overlap.
  constraint visit_no_overlap exclude using gist (staff_id with =, during with &&)
    where (status in ('oczekuje', 'potwierdzona'))
);
create index visit_salon_time on visit (salon_id, starts_at);

-- Every SMS (and later other channels) is a row: the panel counts them per salon.
create table notification (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salon (id) on delete cascade,
  visit_id uuid,
  staff_id uuid,
  type text not null,
  channel text not null default 'sms',
  to_phone text not null,
  body text not null,
  status text not null default 'queued' check (status in ('queued', 'logged', 'sent', 'failed')),
  provider text not null,
  provider_id text,
  cost_grosze int not null default 0,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  foreign key (salon_id, visit_id) references visit (salon_id, id) on delete cascade,
  foreign key (salon_id, staff_id) references staff (salon_id, id) on delete cascade
);
create index notification_salon on notification (salon_id, created_at);

-- Staff sessions. id = sha256 of the cookie token, never the token itself.
create table session (
  id text primary key,
  salon_id uuid not null,
  staff_id uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  foreign key (salon_id, staff_id) references staff (salon_id, id) on delete cascade
);

-- One-time SMS codes (staff login, client phone check). Only a hash is stored.
create table sms_code (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references salon (id) on delete cascade,
  phone text not null,
  purpose text not null check (purpose in ('staff_login', 'client_verify')),
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index sms_code_lookup on sms_code (salon_id, phone, purpose, created_at desc);

-- Fixed-window rate limits. salon_id is null for limits that are not tied to one salon (an IP address).
create table rate_limit (
  key text not null,
  window_start timestamptz not null,
  salon_id uuid references salon (id) on delete cascade,
  count int not null default 0,
  primary key (key, window_start)
);
