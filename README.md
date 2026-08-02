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
  season, with points, win-rate and streaks. Every game above scores (see
  [Leaderboard](#leaderboard)).
- **Profile** (`#/profile`) — your own stats: totals, streaks, a per-game
  breakdown and the guess distribution for Wordles you solved. Reached from
  **Wasifu** in the top bar, which replaces the **Ingia** (sign in) option once
  you have an account (see [Accounts](#accounts-supabase-auth)).

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

**Every daily game scores.** Each one can be played for points once per day
(first finish wins, so a replay can't re-score it), and your standing for a day
is the sum of that day's games.

| Game | Points |
| --- | --- |
| Neno la Leo and the 3/4/6-letter variants | `max(20, (6 − guesses + 1) × 20)` → 120 for a first-guess solve down to 20 on the sixth; **10 for finishing without getting it** |
| Tafuta Maneno | By solve time: 150 under 1 min, then 125 / 100 / 80 / 60 / 40 / 30 / 20 at each further minute, 10 for any finish |
| Oanisha Maneno | 100 less 15 per wrong pairing, floor 25 |

The formulas live in `src/lib/leaderboard.ts` and are **repeated as CHECK
constraints** in [`supabase/schema.sql`](supabase/schema.sql) so a tampered
client can't inflate a score — change one and you must change the other.

The board ranks you for the individual day and the all-time season. It has two
modes, chosen automatically by whether Supabase credentials are present:

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
   It is safe to re-run, and migrates an existing single-game `scores` table in
   place (adding the `game` column and backfilling old rows as `wordle-5`).
3. Copy `.env.example` to `.env.local` and fill in your **Project URL** and
   **anon / public key** (Project Settings → API).
4. `npm run dev` (or rebuild for prod). The app now reads/writes the shared board.

The anon key is meant to be public in the client — RLS is what constrains it:
reads are open, inserts are append-only, points must match the scoring formula,
and one row per device per day is enforced by a unique constraint.

### Accounts (Supabase Auth)

The finish screen's **Sign up to track progress** — and the **Ingia** option in
the top bar — are passwordless: the player enters an email, Supabase Auth emails
a **six-digit code**, and typing it back signs them in. Their account id then
becomes their leaderboard identity so progress follows them across devices; when
signed out (or with no backend) an anonymous per-device id is used instead.

Signing in swaps the top-bar option to **Wasifu**, the player's profile at
`#/profile`. It reads every `scores` row filed under any id the player owns, so
the stats there cover all their devices, and folds in results this device has
saved but not yet published so a fresh finish is never missing.

**Codes, not magic links** — on purpose. A link opened from a phone's mail app
launches that app's *in-app* browser, which has its own `localStorage`, so the
PKCE verifier written when the link was requested isn't there and the exchange
fails. Our players are overwhelmingly on phones, so links lost a large share of
sign-ins to a failure neither side could see. A code is retyped in the browser
that started the flow, so the session lands where the player actually is.

To enable it, in the Supabase dashboard under **Authentication**:

1. Ensure **Email** sign-in is enabled (it is by default).
2. **Email Templates → Magic Link**: replace `{{ .ConfirmationURL }}` with
   `{{ .Token }}`. This is what makes Supabase send a code instead of a link —
   `verifySignInCode` in [`src/lib/auth.ts`](src/lib/auth.ts) has nothing to
   accept until this is changed, so **sign-in stays broken if you skip it**.
3. Under **URL Configuration**, set the **Site URL** to `https://tatuafumbo.com`
   and add `http://localhost:5173/` as a **Redirect URL** for local dev.
4. Configure **custom SMTP** (next section) — otherwise sending is capped at
   roughly two emails per hour across the whole project.

No schema change is needed — signed-in scores use the same `scores` table.

### Sending email (custom SMTP)

Supabase's built-in mailer is a shared testing service limited to about **2
emails per hour, project-wide**. That is a hard ceiling on sign-ups, and it is
lifted by pointing Auth at your own sender: **Project Settings → Authentication
→ SMTP Settings**. Once any custom SMTP is set, the cap becomes whatever you
configure under **Authentication → Rate Limits** (default 30/hour).

Two options, both free at our volume:

- **Resend** (recommended, ~3,000/month free) — verify `tatuafumbo.com` in the
  Resend dashboard, add the DKIM/SPF records it generates to DNS, then send as
  `hello@tatuafumbo.com`. Best deliverability, and the From address matches the
  site.
- **Gmail** — host `smtp.gmail.com`, port `587`, your Google address, and an
  **app password** (requires 2FA on the account). No DNS setup, ~500/day, but
  mail arrives from a personal address.

Credentials live in the Supabase dashboard only. Never commit them — nothing in
this repo needs them, since the app asks Supabase to send and never sends mail
itself.

### Troubleshooting: the board says "Bado hakuna alama"

That message means the shared board came back with **zero rows**. Your own
finished games are always merged in locally, so if you see it right after
playing, scores are not reaching the `scores` table at all. Work through this in
order:

1. **Is the backend actually configured in the deployed build?** The GitHub Pages
   workflow injects `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from repo
   **Settings → Secrets and variables → Actions**. If they're unset the build
   falls back to the simulated field (a roster of bot names) rather than an
   empty board — so an *empty* board means the keys are present.
2. **Has the schema been applied?** In the Supabase **SQL Editor**, run
   `select count(*) from public.scores;`. A "relation does not exist" error means
   [`supabase/schema.sql`](supabase/schema.sql) was never run — run it now. A
   count of `0` means reads work but writes are being rejected; continue.
3. **Can the public key write?** Re-run `supabase/schema.sql` (it's idempotent).
   It grants `select, insert` on `public.scores` to `anon`/`authenticated` and
   recreates the RLS policies. A missing INSERT grant or policy rejects every
   submission while leaving reads working — exactly the empty-board symptom.
4. **Check the browser console.** Failed submissions log
   `submitDaily failed: <reason>`, and the leaderboard page shows a red banner
   when publishing fails. The reason names the constraint, policy, or network
   error responsible.

Results are stored locally with a `published` flag, so anything that failed to
send is retried automatically the next time the leaderboard page is opened —
once the cause above is fixed, backlogged days publish themselves.

## Usage analytics

A privacy-light analytics backend tracks **how many people use the game and how
often**, surfaced on a **private** in-app dashboard at `#/analytics`. It reuses
the same Supabase project as the leaderboard and is entirely optional — with no
backend configured, nothing is collected and the dashboard shows a setup note.

The dashboard is a **separate internal page** with its own HTML entry point and
bundle (`admin.html` / `src/admin.tsx`) — it is not part of the game app, has no
nav link, and isn't routed to from anywhere in the site. Reach it directly at
`https://<your-site>/admin.html` and enter the passphrase (`changamoto` by
default — change `DASHBOARD_PASSWORD` in `src/pages/AnalyticsPage.tsx`).

The passphrase is a **light gate, not real security**: the page is a public
static file, so anyone who knows the word (or reads the client bundle) can view
the aggregate stats. What is protected at the database level is the **raw event
stream** — it has no SELECT policy, so only the non-personal aggregate views are
ever exposed. Players can *write* events but nobody can read individual rows
through the API.

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
   creates the append-only `events` table (insert-only; no read policy on the raw
   rows) and the definer aggregate views the dashboard reads
   (`analytics_overview` / `analytics_daily` / `analytics_games` /
   `analytics_retention`). Safe to re-run.
2. Open `<your-site>/admin.html`, enter the passphrase, and view the dashboard.
   The game logs events automatically for everyone — no player login required.

Privacy model: the anon key is safe in the client — the raw `events` rows have
no SELECT policy so they can't be read through the API; only the non-personal
aggregate views (definer, granted to the public key) are exposed. The dashboard
passphrase is client-side obscurity on top of that.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build to dist/
npm run preview    # preview the production build
```

## Deploy

The site is served by GitHub Pages on the custom domain
**https://tatuafumbo.com**, so `vite.config.ts` sets `base: '/'` and
[`public/CNAME`](public/CNAME) carries the domain. Vite copies `public/` into
`dist/`, and `dist/` is what the workflow uploads — keeping `CNAME` in the build
output is what stops a deploy from clearing the custom-domain setting. Moving
back to a `github.io/changamoto/` sub-path means restoring `base` as well, or
every asset URL 404s.

DNS at the registrar — four A records on the apex, pointing at GitHub Pages:

```
185.199.108.153   185.199.109.153   185.199.110.153   185.199.111.153
```

plus a `CNAME` on `www` → `<user>.github.io`. Then in **Settings → Pages** set
the custom domain and, once the certificate finishes issuing, tick **Enforce
HTTPS**. Mail records (MX, DKIM, SPF) are independent of these and can coexist —
A records route web traffic, MX routes mail.
