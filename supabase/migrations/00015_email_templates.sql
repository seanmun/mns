-- Email templates table for transactional emails (managed via Admin UI, sent via Resend)
create table if not exists email_templates (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  subject text not null,
  html_body text not null default '',
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS: only authenticated users can read (edge function uses service role to bypass)
alter table email_templates enable row level security;

create policy "Authenticated users can read email templates"
  on email_templates for select
  to authenticated
  using (true);

-- Seed template rows (HTML bodies are empty — user fills via Admin UI or kinetic.email)
insert into email_templates (name, subject, html_body, description) values
  ('trade-proposed', 'Trade Proposal from {{proposerTeamName}}', '', 'Sent to all involved teams when a trade is proposed'),
  ('trade-accepted', 'Trade Accepted — {{acceptingTeamName}}', '', 'Sent to all involved teams when a team accepts'),
  ('trade-rejected', 'Trade Rejected by {{rejectingTeamName}}', '', 'Sent to proposer when a team rejects'),
  ('wager-proposed', 'Wager Proposal from {{proposerTeamName}}', '', 'Sent to opponent when a wager is proposed'),
  ('wager-accepted', 'Wager Accepted by {{opponentTeamName}}', '', 'Sent to proposer when opponent accepts'),
  ('wager-declined', 'Wager Declined by {{opponentTeamName}}', '', 'Sent to proposer when opponent declines'),
  ('roster-alert', 'MNS Weekly Roster Alert — {{weekLabel}}', '', 'Monday morning roster check email');
