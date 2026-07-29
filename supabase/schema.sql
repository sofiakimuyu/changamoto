-- Changamoto shared leaderboard schema.
-- Run this in your Supabase project: SQL Editor → New query → paste → Run.
-- Safe to re-run: it migrates an existing table in place.
--
-- Model: one row per device (client_id) per day per game. Every daily game
-- scores — the four Wordle variants, Tafuta Maneno and Oanisha Maneno — and a
-- player's standing for a day is the sum of that day's rows. Anonymous by
-- default; a random client_id ties a player's rows together for all-time
-- totals, or their auth user id once they sign in. The anon (public) key may
-- INSERT and SELECT only, guarded by Row Level Security and the integrity
-- checks below.

-- ── Table ─────────────────────────────────────────────────────────────────────
create table if not exists public.scores (
  id         uuid primary key default gen_random_uuid(),
  client_id  text not null,
  name       text not null,
  day        integer not null,
  game       text not null default 'wordle-5',
  solved     boolean not null,
  guesses    integer,   -- Wordle only; null for the other games
  points     integer not null,
  created_at timestamptz not null default now()
);

-- ── Migration from the single-game schema ─────────────────────────────────────
-- Earlier versions had no `game` column, allowed one row per (client_id, day),
-- and required `guesses`. Existing rows are all the 5-letter daily, which the
-- column default backfills.
alter table public.scores add column if not exists game text not null default 'wordle-5';
alter table public.scores alter column guesses drop not null;

-- ── Integrity ─────────────────────────────────────────────────────────────────
-- Constraints are dropped and re-added by name so this file stays re-runnable.
-- The old inline constraints carried Postgres' auto-generated names; drop those
-- too so a pre-existing table picks up the new rules.
alter table public.scores drop constraint if exists scores_client_id_check;
alter table public.scores drop constraint if exists scores_name_check;
alter table public.scores drop constraint if exists scores_guesses_check;
alter table public.scores drop constraint if exists scores_points_check;
alter table public.scores drop constraint if exists scores_check;
alter table public.scores drop constraint if exists scores_game_check;
alter table public.scores drop constraint if exists scores_points_match_game;
alter table public.scores drop constraint if exists scores_client_id_day_key;
alter table public.scores drop constraint if exists scores_client_id_day_game_key;

-- A finished Wordle that wasn't solved now scores 10 rather than 0. Rescore any
-- rows recorded under the old scheme, otherwise they fail the CHECK below (and
-- the ALTER that adds it). Runs after the old constraints are dropped, since
-- the previous check pinned an unsolved game to exactly 0.
update public.scores
   set points = 10
 where not solved and points = 0 and game like 'wordle-%';

alter table public.scores
  add constraint scores_client_id_check check (char_length(client_id) between 1 and 64),
  add constraint scores_name_check      check (char_length(name) between 1 and 20),
  add constraint scores_guesses_check   check (guesses is null or guesses between 1 and 6),
  add constraint scores_points_check    check (points between 0 and 150),
  add constraint scores_game_check      check (game in (
    'wordle-3', 'wordle-4', 'wordle-5', 'wordle-6', 'wordsearch', 'pairmatch'
  )),
  -- First finished result per device, per day, per game wins; blocks spam and
  -- re-rolls while still letting one player score every game each day.
  add constraint scores_client_id_day_game_key unique (client_id, day, game);

-- Points must match the client scoring formulas, so a tampered client can't
-- inflate its score. These MUST stay in sync with the point functions in
-- src/lib/leaderboard.ts — change one and you must change the other.
alter table public.scores
  add constraint scores_points_match_game check (
    case
      -- Tafuta Maneno: time tiers (pointsForWordSearch).
      when game = 'wordsearch' then
        solved and guesses is null and points in (10, 20, 30, 40, 60, 80, 100, 125, 150)
      -- Oanisha Maneno: 100 less 15 per mistake, floor 25 (pointsForPairMatch).
      when game = 'pairmatch' then
        solved and guesses is null and points in (25, 40, 55, 70, 85, 100)
      -- Wordle, any length: max(20, (6 - guesses + 1) * 20) when solved,
      -- and a flat 10 for finishing without getting it (pointsForWordle).
      else
        guesses is not null
        and points = case when solved then greatest(20, (6 - guesses + 1) * 20) else 10 end
    end
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
-- `played` counts games finished (not days), matching the "Michezo" stat.
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
