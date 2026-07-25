-- Changamoto usage-analytics schema.
-- Run this in your Supabase project: SQL Editor → New query → paste → Run.
-- (Independent of scores/schema.sql — you can run either or both.)
--
-- Model: an append-only stream of anonymous usage events. Each event ties to a
-- device (client_id) and a browsing session (session_id) so we can measure how
-- many people use the game and how often. No personal data is collected.
--
-- Privacy: anyone may INSERT events (so the game can log usage). The raw event
-- rows are NOT readable through the API (no SELECT policy on the table). Only the
-- non-personal AGGREGATE views below are exposed — they run as the view owner
-- (definer) so they can read the table, and are granted to the public key. The
-- internal dashboard adds a light passphrase gate on top (client-side).

-- ── Events table ──────────────────────────────────────────────────────────────
create table if not exists public.events (
  id         uuid primary key default gen_random_uuid(),
  client_id  text not null check (char_length(client_id) between 1 and 64),
  session_id text not null check (char_length(session_id) between 1 and 64),
  -- Event name, e.g. 'session_start', 'page_view', 'game_start', 'game_complete'.
  name       text not null check (char_length(name) between 1 and 40),
  -- Optional route path ('/wordle/5') and game key ('wordle-5', 'wordsearch').
  path       text check (char_length(path) <= 120),
  game       text check (char_length(game) <= 40),
  -- Free-form extra context (result, guesses, etc.). Small by construction.
  props      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists events_created_idx  on public.events (created_at);
create index if not exists events_name_idx      on public.events (name);
create index if not exists events_client_idx    on public.events (client_id);
create index if not exists events_game_idx      on public.events (game);

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table public.events enable row level security;

-- WRITE stays open so every player's client can log usage. Insert doesn't return
-- rows (supabase-js insert is minimal), so it needs no read access.
-- No UPDATE/DELETE policies → append-only.
drop policy if exists "anyone can log an event" on public.events;
create policy "anyone can log an event"
  on public.events for insert
  with check (true);

-- No SELECT policy → the raw event rows can't be read through the API by anyone
-- (anon or authenticated). Analytics are read only via the aggregate views below.
-- (Clean up policies from earlier revisions if present.)
drop policy if exists "events are public" on public.events;
drop policy if exists "only admins read events" on public.events;

-- Remove the admin-allowlist machinery from earlier revisions (now unused; the
-- dashboard uses a client-side passphrase instead of per-account access).
drop function if exists public.is_analytics_admin();
drop table if exists public.analytics_admins;

-- ── Aggregate views ───────────────────────────────────────────────────────────
-- SELECT-only summaries. Declared `security_invoker = false` (definer) so they
-- run as the view owner and CAN read `events` even though the table has no SELECT
-- policy — exposing only these non-personal aggregates, never the raw rows. Read
-- access is granted to the public key (anon) so the dashboard works without login.

-- Headline totals: lifetime unique devices, sessions, events, and game plays.
create or replace view public.analytics_overview
  with (security_invoker = false) as
select
  count(distinct client_id)                                            as total_users,
  count(distinct session_id)                                           as total_sessions,
  count(*)                                                             as total_events,
  count(*) filter (where name = 'game_start')                          as total_plays,
  count(*) filter (where name = 'game_complete')                       as total_completions,
  count(distinct client_id) filter (where created_at > now() - interval '1 day')  as active_users_1d,
  count(distinct client_id) filter (where created_at > now() - interval '7 day')  as active_users_7d,
  count(distinct client_id) filter (where created_at > now() - interval '30 day') as active_users_30d
from public.events;

-- Daily activity: one row per calendar day (UTC) with active users, sessions,
-- new users (first-ever-seen that day) and plays. Powers the trend chart.
create or replace view public.analytics_daily
  with (security_invoker = false) as
with firsts as (
  select client_id, min(created_at)::date as first_day
  from public.events group by client_id
)
select
  e.created_at::date                                    as day,
  count(distinct e.client_id)                           as active_users,
  count(distinct e.session_id)                          as sessions,
  count(*) filter (where e.name = 'game_start')         as plays,
  count(*) filter (where e.name = 'page_view')          as page_views,
  count(distinct f.client_id) filter (where f.first_day = e.created_at::date) as new_users
from public.events e
left join firsts f on f.client_id = e.client_id
group by e.created_at::date
order by day;

-- Popularity per game: plays, completions, unique players, completion rate.
create or replace view public.analytics_games
  with (security_invoker = false) as
select
  coalesce(game, 'unknown')                              as game,
  count(*) filter (where name = 'game_start')            as plays,
  count(*) filter (where name = 'game_complete')         as completions,
  count(distinct client_id) filter (where name in ('game_start','game_complete')) as players,
  round(
    100.0 * count(*) filter (where name = 'game_complete')
    / nullif(count(*) filter (where name = 'game_start'), 0)
  , 0)                                                    as completion_rate
from public.events
where game is not null
group by coalesce(game, 'unknown')
order by plays desc;

-- Engagement / stickiness: how many days each device has been active, bucketed.
-- (1 day = one-and-done, higher buckets = returning players.)
create or replace view public.analytics_retention
  with (security_invoker = false) as
with per_user as (
  select client_id, count(distinct created_at::date) as active_days
  from public.events group by client_id
)
select
  case
    when active_days = 1 then '1 day'
    when active_days between 2 and 3 then '2-3 days'
    when active_days between 4 and 7 then '4-7 days'
    else '8+ days'
  end                    as bucket,
  count(*)               as users
from per_user
group by 1;

grant select on
  public.analytics_overview,
  public.analytics_daily,
  public.analytics_games,
  public.analytics_retention
to anon, authenticated;
