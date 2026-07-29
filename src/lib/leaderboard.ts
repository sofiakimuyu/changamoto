// Leaderboard for the classic daily Wordle (Neno la Leo). It ranks the player
// for the individual day and for the running all-time season.
//
// ── Backend vs. fallback ───────────────────────────────────────────────────
// When Supabase is configured (VITE_SUPABASE_URL/ANON_KEY set) the board shows
// REAL players from the shared `scores` table. When it isn't — local dev or a
// preview without keys — the async board functions fall back to a deterministic
// SIMULATED community so the UI still has something to render. The player's own
// results are always saved locally too, for instant stats and offline play.
//
// The UI consumes only `getDailyBoard` / `getAllTimeBoard` (async) and
// `submitDaily`, so the storage backing them can change without touching pages.

import { MAX_ROWS, getDayIndex } from './wordle'
import { supabase, hasBackend, identityId, identityIds, identityReady } from './supabase'

const NAME_KEY = 'changamoto_player_name'
const RESULTS_KEY = 'changamoto_daily_results_v1'

// First day the all-time season counts from (the app's launch day index).
export const LAUNCH_DAY = 20658 // 2026-07-24

export interface DailyResult {
  day: number
  solved: boolean
  guesses: number // number of guesses used (rows played)
  points: number
  ts: number
  /** True once this result is known to exist on the shared board. Results saved
   *  before this flag existed are treated as unpublished and re-sent, which is
   *  harmless — a duplicate insert is ignored. */
  published?: boolean
}

export interface LeaderRow {
  name: string
  points: number
  detail: string   // e.g. "3/6" for a day, or "12 played · 78% win" all-time
  isPlayer: boolean
}

/** Where a board's rows came from, so the UI can explain what it's showing. */
export type BoardSource = 'shared' | 'local'

export interface Board {
  rows: LeaderRow[]
  playerRank: number | null
  source: BoardSource
  /** Set when the shared board couldn't be read; rows fall back to local. */
  error: string | null
}

// ── Scoring ───────────────────────────────────────────────────────────────
/** Points for a finished daily game. Fewer guesses → more points; a loss = 0. */
export function pointsFor(solved: boolean, guesses: number): number {
  if (!solved) return 0
  return Math.max(20, (MAX_ROWS - guesses + 1) * 20) // 1 guess→120 … 6 guesses→20
}

// ── Player identity ─────────────────────────────────────────────────────────
export function getPlayerName(): string {
  try { return localStorage.getItem(NAME_KEY) || '' } catch { return '' }
}
export function setPlayerName(name: string): void {
  try { localStorage.setItem(NAME_KEY, name.trim().slice(0, 20)) } catch { /* ignore */ }
}

// ── Result persistence ──────────────────────────────────────────────────────
function loadResults(): Record<number, DailyResult> {
  try {
    const raw = localStorage.getItem(RESULTS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}
function saveResults(r: Record<number, DailyResult>): void {
  try { localStorage.setItem(RESULTS_KEY, JSON.stringify(r)) } catch { /* ignore */ }
}

/** Record a finished daily game (idempotent per day — first result wins). */
export function recordDaily(day: number, solved: boolean, guesses: number): void {
  const results = loadResults()
  if (results[day]) return
  results[day] = { day, solved, guesses, points: pointsFor(solved, guesses), ts: Date.now() }
  saveResults(results)
}

/** Remember that a day's result made it onto the shared board. */
function markPublished(day: number): void {
  const results = loadResults()
  if (!results[day] || results[day].published) return
  results[day] = { ...results[day], published: true }
  saveResults(results)
}

export function getPlayerResult(day: number): DailyResult | null {
  return loadResults()[day] ?? null
}

// ── Player stats ────────────────────────────────────────────────────────────
export interface PlayerStats {
  played: number
  wins: number
  winRate: number
  totalPoints: number
  currentStreak: number
  bestStreak: number
}

export function getPlayerStats(): PlayerStats {
  const results = loadResults()
  const days = Object.keys(results).map(Number).sort((a, b) => a - b)
  let wins = 0, totalPoints = 0
  for (const d of days) { if (results[d].solved) wins++; totalPoints += results[d].points }

  // Streaks count consecutive solved days.
  let best = 0, run = 0, prev: number | null = null
  for (const d of days) {
    const solved = results[d].solved
    if (solved && prev !== null && d === prev + 1) run++
    else if (solved) run = 1
    else run = 0
    if (run > best) best = run
    prev = d
  }
  // Current streak: consecutive solved days ending at today (or yesterday).
  const today = getDayIndex()
  let current = 0, cursor = results[today] ? today : today - 1
  while (results[cursor]?.solved) { current++; cursor-- }

  return {
    played: days.length,
    wins,
    winRate: days.length ? Math.round((wins / days.length) * 100) : 0,
    totalPoints,
    currentStreak: current,
    bestStreak: best,
  }
}

// ── Simulated community ──────────────────────────────────────────────────────
// A fixed roster of players with a per-player skill (0..1). Their daily results
// are derived deterministically from (day, seed) so the board is stable.
interface Bot { name: string; seed: number; skill: number }

const BOT_NAMES = [
  'Amani', 'Baraka', 'Zawadi', 'Neema', 'Jabari', 'Imani', 'Kesi', 'Tumaini',
  'Salama', 'Bahati', 'Furaha', 'Nuru', 'Pendo', 'Subira', 'Rehema', 'Hekima',
  'Malaika', 'Sanaa', 'Upendo', 'Faraja', 'Chausiku', 'Dalila', 'Jabali', 'Kito',
]
const BOTS: Bot[] = BOT_NAMES.map((name, i) => ({
  name,
  seed: 1000 + i * 97,
  // Skill spread 0.55..0.95 so the field is beatable but competitive.
  skill: 0.55 + ((i * 53) % 40) / 100,
}))

// Small deterministic PRNG in [0,1).
function rng(seed: number): number {
  const s = (seed * 1664525 + 1013904223) & 0xffffffff
  return Math.abs(s) / 0x7fffffff
}

/** A bot's simulated result for one day: guesses + points. */
function botDay(bot: Bot, day: number): { solved: boolean; guesses: number; points: number } {
  const r = rng(bot.seed ^ (day * 2654435761))
  const solved = r < bot.skill
  if (!solved) return { solved: false, guesses: MAX_ROWS, points: 0 }
  // Skilled players skew toward fewer guesses.
  const r2 = rng(bot.seed * 3 + day)
  const spread = r2 * (1 - bot.skill * 0.6)
  const guesses = Math.min(MAX_ROWS, Math.max(2, Math.round(2 + spread * 5)))
  return { solved: true, guesses, points: pointsFor(true, guesses) }
}

// ── Public: assembled boards ─────────────────────────────────────────────────
function playerLabel(): string {
  return getPlayerName() || 'You'
}

/** Simulated ranked board for a single day (fallback when no backend). */
function getSimulatedDaily(day: number): { rows: LeaderRow[]; playerRank: number | null } {
  const rows: LeaderRow[] = BOTS.map(b => {
    const d = botDay(b, day)
    return { name: b.name, points: d.points, detail: d.solved ? `${d.guesses}/${MAX_ROWS}` : 'X/6', isPlayer: false }
  })

  const pr = getPlayerResult(day)
  if (pr) {
    rows.push({
      name: playerLabel(),
      points: pr.points,
      detail: pr.solved ? `${pr.guesses}/${MAX_ROWS}` : 'X/6',
      isPlayer: true,
    })
  }

  rows.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
  const playerRank = pr ? rows.findIndex(r => r.isPlayer) + 1 : null
  return { rows, playerRank }
}

/** Simulated ranked all-time board over the season (fallback when no backend). */
function getSimulatedAllTime(): { rows: LeaderRow[]; playerRank: number | null } {
  const today = getDayIndex()
  const start = Math.min(LAUNCH_DAY, today)
  const seasonDays: number[] = []
  for (let d = start; d <= today; d++) seasonDays.push(d)

  const rows: LeaderRow[] = BOTS.map(b => {
    let points = 0, played = 0, wins = 0
    for (const d of seasonDays) {
      const r = botDay(b, d)
      points += r.points; played++
      if (r.solved) wins++
    }
    const winRate = played ? Math.round((wins / played) * 100) : 0
    return { name: b.name, points, detail: `${played} played · ${winRate}% win`, isPlayer: false }
  })

  const stats = getPlayerStats()
  rows.push({
    name: playerLabel(),
    points: stats.totalPoints,
    detail: `${stats.played} played · ${stats.winRate}% win`,
    isPlayer: true,
  })

  rows.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
  const playerRank = rows.findIndex(r => r.isPlayer) + 1
  return { rows, playerRank }
}

// ── Shared backend (Supabase) ────────────────────────────────────────────────
interface ScoreRow { client_id: string; name: string; points: number; solved: boolean; guesses: number }

/** Outcome of publishing to the shared board. `ok` is false only on a real
 *  failure — with no backend configured there is nothing to publish. */
export interface SubmitOutcome { ok: boolean; error: string | null }

const NOTHING_TO_DO: SubmitOutcome = { ok: true, error: null }

/** Postgres unique-violation: the row is already on the board, so we're done. */
const UNIQUE_VIOLATION = '23505'

/**
 * Submit the player's finished daily result to the shared board (idempotent).
 *
 * A plain INSERT is used rather than an upsert: the board is append-only (the
 * schema grants anon INSERT and SELECT only, with no UPDATE policy), so an
 * upsert's conflict resolution has nothing to fall back on. The unique
 * (client_id, day) constraint gives idempotency for free — a repeat submit
 * comes back as 23505, which means the score is already published.
 */
export async function submitDaily(day: number): Promise<SubmitOutcome> {
  if (!hasBackend || !supabase) return NOTHING_TO_DO
  const pr = getPlayerResult(day)
  if (!pr) return NOTHING_TO_DO

  // Wait for the session so a signed-in player's score is filed under their
  // account id, not the device id it would race to otherwise.
  await identityReady

  const name = (getPlayerName() || 'Anonymous').trim().slice(0, 20) || 'Anonymous'
  try {
    const { error } = await supabase
      .from('scores')
      .insert({ client_id: identityId(), name, day, solved: pr.solved, guesses: pr.guesses, points: pr.points })
    if (!error || error.code === UNIQUE_VIOLATION) {
      markPublished(day)
      return NOTHING_TO_DO
    }
    console.warn('submitDaily failed:', error.message, error.details ?? '')
    return { ok: false, error: error.message }
  } catch (e) {
    // Network failure — the result stays unpublished and is retried later.
    const message = e instanceof Error ? e.message : String(e)
    console.warn('submitDaily failed:', message)
    return { ok: false, error: message }
  }
}

/**
 * Re-send every finished day that never reached the shared board.
 *
 * Without this a single failed submit (offline, a transient error, or playing
 * before the backend was reachable) would drop that day for good: nothing else
 * ever retries, so the player finishes a game and never appears on the board.
 */
export async function syncPendingResults(): Promise<SubmitOutcome> {
  if (!hasBackend || !supabase) return NOTHING_TO_DO
  const pending = Object.values(loadResults())
    .filter(r => !r.published)
    .map(r => r.day)
    .sort((a, b) => a - b)

  let error: string | null = null
  for (const day of pending) {
    const outcome = await submitDaily(day)
    if (!outcome.ok) error = outcome.error
  }
  return { ok: error === null, error }
}

function rankRows(rows: LeaderRow[]): { rows: LeaderRow[]; playerRank: number | null } {
  rows.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
  const idx = rows.findIndex(r => r.isPlayer)
  return { rows, playerRank: idx >= 0 ? idx + 1 : null }
}

function dailyDetail(solved: boolean, guesses: number): string {
  return solved ? `${guesses}/${MAX_ROWS}` : `X/${MAX_ROWS}`
}

/** Real (or simulated) ranked board for a single day. */
export async function getDailyBoard(day: number): Promise<Board> {
  if (!hasBackend || !supabase) return { ...getSimulatedDaily(day), source: 'local', error: null }

  await identityReady
  const mine = identityIds()
  const { data, error } = await supabase
    .from('scores')
    .select('client_id,name,points,solved,guesses')
    .eq('day', day)
    .order('points', { ascending: false })
  if (error) {
    console.warn('getDailyBoard failed:', error.message)
    return { ...getSimulatedDaily(day), source: 'local', error: error.message }
  }

  const rows: LeaderRow[] = (data as ScoreRow[]).map(r => {
    const isPlayer = mine.includes(r.client_id)
    return {
      name: isPlayer ? (getPlayerName() || r.name) : r.name,
      points: r.points,
      detail: dailyDetail(r.solved, r.guesses),
      isPlayer,
    }
  })

  // The player's own finished game always shows, even when the shared board has
  // no row for it yet — first play of the day, a submit that hasn't landed, or
  // an offline finish. Being told "no scores yet" right after playing is the
  // one thing the board must never do.
  if (!rows.some(r => r.isPlayer)) {
    const pr = getPlayerResult(day)
    if (pr) {
      rows.push({
        name: playerLabel(),
        points: pr.points,
        detail: dailyDetail(pr.solved, pr.guesses),
        isPlayer: true,
      })
    }
  }
  return { ...rankRows(rows), source: 'shared', error: null }
}

interface AllTimeRow { client_id: string; name: string; points: number; played: number; wins: number }

/** Real (or simulated) ranked all-time board. */
export async function getAllTimeBoard(): Promise<Board> {
  if (!hasBackend || !supabase) return { ...getSimulatedAllTime(), source: 'local', error: null }

  await identityReady
  const mine = identityIds()
  const { data, error } = await supabase
    .from('alltime_leaderboard')
    .select('client_id,name,points,played,wins')
    .order('points', { ascending: false })
  if (error) {
    console.warn('getAllTimeBoard failed:', error.message)
    return { ...getSimulatedAllTime(), source: 'local', error: error.message }
  }

  const rows: LeaderRow[] = (data as AllTimeRow[]).map(r => {
    const winRate = r.played ? Math.round((r.wins / r.played) * 100) : 0
    const isPlayer = mine.includes(r.client_id)
    return {
      name: isPlayer ? (getPlayerName() || r.name) : r.name,
      points: r.points,
      detail: `${r.played} played · ${winRate}% win`,
      isPlayer,
    }
  })

  // Same guarantee as the daily board: if none of the shared rows are the
  // player's, fall back to their locally recorded season.
  if (!rows.some(r => r.isPlayer)) {
    const stats = getPlayerStats()
    if (stats.played > 0) {
      rows.push({
        name: playerLabel(),
        points: stats.totalPoints,
        detail: `${stats.played} played · ${stats.winRate}% win`,
        isPlayer: true,
      })
    }
  }
  return { ...rankRows(rows), source: 'shared', error: null }
}
