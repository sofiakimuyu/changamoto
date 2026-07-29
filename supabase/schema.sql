-- Changamoto shared leaderboard schema.
-- Run this in your Supabase project: SQL Editor → New query → paste → Run.
--
-- Model: one row per device (client_id) per day for the ranked daily game
-- (the 5-letter Neno la Leo). Anonymous — no auth; a random client_id ties a
-- player's days together for all-time totals. The anon (public) key may INSERT
-- and SELECT only, guarded by Row Level Security and integrity checks below.

-- ── Table ─────────────────────────────────────────────────────────────────────
create table if not exists public.scores (
  id         uuid primary key default gen_random_uuid(),
  client_id  text not null check (char_length(client_id) between 1 and 64),
  name       text not null check (char_length(name) between 1 and 20),
  day        integer not null,
  solved     boolean not null,
  guesses    integer not null check (guesses between 1 and 6),
  points     integer not null check (points between 0 and 120),
  created_at timestamptz not null default now(),
  -- First finished result per device per day wins; blocks spam / re-rolls.
  unique (client_id, day),
  -- Points must match the client scoring formula, so a tampered client can't
  -- inflate its score: solved → max(20,(6-guesses+1)*20); lost → 0.
  check (points = case when solved then greatest(20, (6 - guesses + 1) * 20) else 0 end)
);

create index if not exists scores_day_points_idx on public.scores (day, points desc);

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table public.scores enable row level security;

-- Anyone (anon) may read the board.
drop policy if exists "scores are public" on public.scores;
create policy "scores are public"
  on public.scores for select
  using (true);

-- Anyone (anon) may submit a score. The CHECK constraints above enforce that the
-- points are internally consistent; the unique constraint prevents duplicates.
drop policy if exists "anyone can submit a score" on public.scores;
create policy "anyone can submit a score"
  on public.scores for insert
  with check (true);
-- Note: no UPDATE/DELETE policies, so rows are append-only from the anon key.

-- RLS policies only ever *restrict*: a role still needs the underlying table
-- privilege. Supabase grants these to anon/authenticated by default, but stating
-- them makes this file self-sufficient — without them every insert is rejected
-- and the board silently stays empty.
grant select, insert on public.scores to anon, authenticated;

-- ── All-time aggregate view ───────────────────────────────────────────────────
-- Sum of points per device across the whole season, with the most recent name.
create or replace view public.alltime_leaderboard as
select
  client_id,
  (array_agg(name order by created_at desc))[1] as name,
  sum(points)                                    as points,
  count(*)                                       as played,
  sum(case when solved then 1 else 0 end)        as wins
from public.scores
group by client_id;

-- Views don't inherit RLS; grant read access to the anon/auth roles explicitly.
grant select on public.alltime_leaderboard to anon, authenticated;
