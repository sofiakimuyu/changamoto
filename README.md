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

### Accounts (Supabase Auth)

The finish screen's **Sign up to track progress** uses passwordless email
magic-links via Supabase Auth. When a player signs in, their account id becomes
their leaderboard identity so progress follows them across devices; when signed
out (or with no backend) an anonymous per-device id is used instead.

To enable it, in the Supabase dashboard under **Authentication**:

1. Ensure **Email** sign-in is enabled (it is by default).
2. Under **URL Configuration**, set the **Site URL** and add a **Redirect URL**
   matching where the app is served, e.g. `https://<user>.github.io/changamoto/`
   (and `http://localhost:5173/` for local dev). The magic link uses the PKCE
   flow, so the code returns in the query string and never collides with the
   app's hash router.

No schema change is needed — signed-in scores use the same `scores` table.

## Usage analytics

A privacy-light analytics backend tracks **how many people use the game and how
often**, surfaced on a **private** in-app dashboard at `#/analytics`. It reuses
the same Supabase project as the leaderboard and is entirely optional — with no
backend configured, nothing is collected and the dashboard shows a setup note.

The dashboard is **owner-only**: any player's client can *write* usage events,
but *reading* the analytics is restricted to accounts on the `analytics_admins`
allowlist. There is no nav link — reach it directly at
`https://<your-site>/#/analytics` and sign in with your admin email.

What's tracked (all anonymous, no personal data):

- **`session_start`** — a new visit (a fresh session after ~30 min idle).
- **`page_view`** — each route the player opens.
- **`game_start` / `game_complete`** — a game opened / finished, with outcome
  (`solved`, `guesses`) in `props`.

Events tie to a stable per-device `client_id` (a "user") and a rotating
`session_id` (a "visit"), so the dashboard can report:

- Lifetime **users**, **sessions**, **plays**, and total events.
- **Active users** over 1 / 7 / 30 days.
- A **daily trend** of active users and plays.
- **Per-game popularity** with completion rates.
- **Returning-player** engagement (how many distinct days each device plays).

### Set up analytics

1. With the shared backend configured (above), in **SQL Editor → New query**
   paste [`supabase/analytics.sql`](supabase/analytics.sql) and **Run**. This
   creates the append-only `events` table (append-only insert, admin-only read
   via RLS), the `analytics_admins` allowlist, the `is_analytics_admin()` helper,
   and the `security_invoker` aggregate views the dashboard reads.
2. **Grant yourself access:** Table Editor → `analytics_admins` → **Insert row**
   → your account email (the one you sign in with). Only listed emails can read
   analytics.
3. Ensure **Email** auth is enabled and your site URL is in the Auth **URL
   Configuration** (same as Accounts above) so the sign-in magic link works.
4. Open `#/analytics`, sign in with your admin email, and view the dashboard.
   The client logs events automatically for everyone.

Privacy model: the anon key is safe in the client — RLS keeps `events`
append-only and its rows **unreadable** to non-admins. The aggregate views are
declared `security_invoker`, so they inherit that admin-only read policy; a
signed-in non-admin (or anonymous visitor) sees no data.

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
