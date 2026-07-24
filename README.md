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

The leaderboard is **local-first**: your own scores are real and saved in the
browser, and the surrounding field is a deterministic simulated community so the
board is lively on a static host. To connect real cross-player rankings, swap
the `getDaily` / `getAllTime` implementations in `src/lib/leaderboard.ts` for a
shared backend — the UI depends only on those two functions.

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
