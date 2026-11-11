-- 002: what the sign-up wizard and the staff panel need.

-- The wizard asks only for names of the team ("Kto pracuje?"). A phone comes later, when the person logs in.
alter table staff alter column phone drop not null;

-- Prices on the public booking page: hidden by default (the wizard does not ask).
alter table salon add column show_prices boolean not null default false;

-- Phone check during "Załóż salon". There is no salon yet, so sms_code (salon_id not null) does not fit.
create table signup_code (
  id uuid primary key default gen_random_uuid(),
  phone text not null check (phone ~ '^\+[0-9]{8,15}$'),
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index signup_code_lookup on signup_code (phone, created_at desc);
