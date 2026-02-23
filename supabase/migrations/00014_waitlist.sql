-- Waitlist for users who sign up but aren't in a league yet
create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  marketing_optin boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Allow authenticated users to insert/update their own row
-- RLS is currently disabled globally (see 00004), but define policies for when it's re-enabled
