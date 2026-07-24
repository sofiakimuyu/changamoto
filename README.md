# Changamoto — Swahili Wordle & word games

A daily Swahili **Wordle** and a small arcade of Swahili word games, built with
Vite + React + TypeScript + Tailwind. The gameplay engine is adapted from the
Wordle challenge in the Hekima app.

## Games

- **Neno la Leo** (home) — the classic 5-letter daily Wordle. One word a day,
  the same for everyone, drawn from a curated 500-word list with definitions,
  sample sentences and usage notes.
- **More games** (`#/games`):
  - 3, 4 and 6-letter Wordle variants, each with its own daily word.
  - **Tafuta Maneno** — a daily word search.
  - **Oanisha Maneno** — a Swahili↔English pair-matching game.
- **Leaderboard** — ranks you for the individual day and the running all-time
  season, with points, win-rate and streaks.

## Word data

Answer pools come from the curated CSVs in `scripts/` provenance (3/4/6-letter)
and the 500-word 5-letter list. Valid-guess lists are generated from the
LibreOffice `sw_TZ` Hunspell dictionary:

```bash
npm run build:wordlist 5        # regenerate data/guesses.json for a length
node scripts/csv-to-answers.mjs <uploads-dir>   # rebuild answers-<n>.ts from CSVs
```

Both the guess lists (`src/data/wordlists/guesses-*.json`) and answer pools
(`src/data/answers-*.ts`) are committed, so the game never fetches at runtime.

## Leaderboard

The leaderboard ranks the classic daily 5-letter game for the individual day and
the all-time season. It has two modes, chosen automatically by whether Supabase
credentials are present:

- **Shared backend (Supabase)** — real cross-player rankings from a shared
  `scores` table. Players are anonymous: each device gets a random id and picks a
  display name (no login).
- **Local fallback** — when no credentials are set (local dev, previews), the
  board shows your real local scores against a deterministic simulated field so
  the UI still renders.

Your own results are always saved locally too, for instant stats and offline play.

### Set up the shared backend

1. Create a project at [supabase.com](https://supabase.com) (the free tier is fine).
2. In the dashboard: **SQL Editor → New query**, paste [`supabase/schema.sql`](supabase/schema.sql), and **Run**.
   This creates the `scores` table, Row Level Security policies (public read,
   append-only insert with integrity checks), and the `alltime_leaderboard` view.
3. Copy `.env.example` to `.env.local` and fill in your **Project URL** and
   **anon / public key** (Project Settings → API).
4. `npm run dev` (or rebuild for prod). The app now reads/writes the shared board.

The anon key is meant to be public in the client — RLS is what constrains it:
reads are open, inserts are append-only, points must match the scoring formula,
and one row per device per day is enforced by a unique constraint.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build to dist/
npm run preview    # preview the production build
```

## Deploy

`vite.config.ts` sets `base: '/changamoto/'` for production builds, matching a
GitHub Pages project site at `https://<user>.github.io/changamoto/`. Adjust the
base if you deploy elsewhere.
