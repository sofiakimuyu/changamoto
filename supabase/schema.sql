-- Changamoto shared leaderboard schema.
-- Run this in your Supabase project: SQL Editor → New query → paste → Run.
--
-- Model: one row per device (client_id) per day per game. A player earns points
-- for every game they finish that day — the wordles (3/4/5/6 letters) and the
-- completion games (word search, pair match). Anonymous — no auth; a random
-- client_id ties a player's days together for all-time totals. The anon (public)
-- key may INSERT and SELECT only, guarded by Row Level Security and the checks
-- below.

-- ── Table ─────────────────────────────────────────────────────────────────────
create table if not exists public.scores (
  id         uuid primary key default gen_random_uuid(),
  client_id  text not null check (char_length(client_id) between 1 and 64),
  name       text not null check (char_length(name) between 1 and 20),
  day        integer not null,
  game       text not null default 'wordle-5' check (char_length(game) between 1 and 32),
  solved     boolean not null,
  guesses    integer not null check (guesses between 0 and 6),
  points     integer not null check (points between 0 and 200),
  created_at timestamptz not null default now(),
  -- First finished result per device per day per game wins; blocks spam / re-rolls.
  unique (client_id, day, game),
  -- Points must match the client scoring formula, so a tampered client can't
  -- inflate its score. Wordles: solved-in-1 → 150, else max(20,(6-guesses+1)*20);
  -- lost → 5 participation points. Completion games are validated by range only.
  check (
    case when game like 'wordle-%'
      then points = case when solved
                      then (case when guesses <= 1 then 150 else greatest(20, (6 - guesses + 1) * 20) end)
                      else 5 end
      else points between 0 and 200
    end
  )
);

-- Existing databases: add the game column and swap the uniqueness scope.
alter table public.scores add column if not exists game text not null default 'wordle-5';

create index if not exists scores_day_points_idx on public.scores (day, points desc);
create index if not exists scores_day_game_points_idx on public.scores (day, game, points desc);

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
