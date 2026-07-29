// Leaderboard across every daily game. It ranks the player for the individual
// day and for the running all-time season.
//
// ── What counts ────────────────────────────────────────────────────────────
// Every daily game earns points: the four Neno la Leo Wordle variants, Tafuta
// Maneno and Oanisha Maneno. Each game can be scored once per day (first finish
// wins), and a day's standing is the sum of that day's games.
//
// The point formulas live here rather than in the game components, because the
// database repeats them as CHECK constraints (see supabase/schema.sql) so a
// tampered client can't inflate a score. The two must agree — change one and
// you must change the other.
//
// ── Backend vs. fallback ───────────────────────────────────────────────────
// When Supabase is configured (VITE_SUPABASE_URL/ANON_KEY set) the board shows
// REAL players from the shared `scores` table. When it isn't — local dev or a
// preview without keys — the async board functions fall back to a deterministic
// SIMULATED community so the UI still has something to render. The player's own
// results are always saved locally too, for instant stats and offline play.
//
// The UI consumes only `getDailyBoard` / `getAllTimeBoard` (async),
// `recordResult` and `syncPendingResults`, so the storage backing them can
// change without touching pages.

import { MAX_ROWS, getDayIndex } from './wordle'
import { supabase, hasBackend, identityId, identityIds, identityReady } from './supabase'

const NAME_KEY = 'changamoto_player_name'
const RESULTS_KEY = 'changamoto_daily_results_v2'
// v1 held only the 5-letter game, keyed by day alone.
const LEGACY_RESULTS_KEY = 'changamoto_daily_results_v1'

// First day the all-time season counts from (the app's launch day index).
export const LAUNCH_DAY = 20658 // 2026-07-24

// ── Games ───────────────────────────────────────────────────────────────────
export type GameId = 'wordle-3' | 'wordle-4' | 'wordle-5' | 'wordle-6' | 'wordsearch' | 'pairmatch'

export const GAME_IDS: GameId[] = ['wordle-3', 'wordle-4', 'wordle-5', 'wordle-6', 'wordsearch', 'pairmatch']

export function wordleGameId(length: number): GameId { return `wordle-${length}` as GameId }

// ── Scoring ─────────────────────────────────────────────────────────────────
/** Wordle, any length: fewer guesses → more points, and finishing without
 *  getting it still scores — turning up counts. */
export function pointsForWordle(solved: boolean, guesses: number): number {
  if (!solved) return 10
  return Math.max(20, (MAX_ROWS - guesses + 1) * 20) // 1 guess→120 … 6 guesses→20
}

// Upper bounds in seconds; the first tier the solve time falls under wins.
const WORD_SEARCH_TIERS: [maxSeconds: number, points: number][] = [
  [60, 150], [120, 125], [180, 100], [240, 80],
  [300, 60], [360, 40], [420, 30], [480, 20],
]
/** Tafuta Maneno: the faster the grid is cleared, the more points. */
export function pointsForWordSearch(seconds: number): number {
  for (const [max, points] of WORD_SEARCH_TIERS) if (seconds < max) return points
  return 10 // any finish is worth something
}

/** Oanisha Maneno: a clean run is worth most, each wrong pairing costs. */
export function pointsForPairMatch(mistakes: number): number {
  return Math.max(25, 100 - mistakes * 15) // perfect→100 … 5+ mistakes→25
}

// ── Player identity ─────────────────────────────────────────────────────────
export function getPlayerName(): string {
  try { return localStorage.getItem(NAME_KEY) || '' } catch { return '' }
}
export function setPlayerName(name: string): void {
  try { localStorage.setItem(NAME_KEY, name.trim().slice(0, 20)) } catch { /* ignore */ }
}

// ── Result persistence ──────────────────────────────────────────────────────
export interface GameResult {
  game: GameId
  day: number
  solved: boolean
  guesses: number | null // Wordle only; null for the other games
  points: number
  ts: number
  /** True once this result is known to exist on the shared board. Results saved
   *  before this flag existed are treated as unpublished and re-sent, which is
   *  harmless — a duplicate insert is ignored. */
  published?: boolean
}

function resultKey(day: number, game: GameId): string { return `${day}:${game}` }

/** Carry v1 results (5-letter game only, keyed by day) over to the v2 shape. */
function migrateLegacyResults(): Record<string, GameResult> {
  const out: Record<string, GameResult> = {}
  try {
    const raw = localStorage.getItem(LEGACY_RESULTS_KEY)
    if (!raw) return out
    const legacy = JSON.parse(raw) as Record<string, Partial<GameResult>>
    for (const r of Object.values(legacy)) {
      if (typeof r?.day !== 'number') continue
      out[resultKey(r.day, 'wordle-5')] = {
        game: 'wordle-5',
        day: r.day,
        solved: !!r.solved,
        guesses: r.guesses ?? null,
        // Rescored, not copied: v1 gave an unsolved game 0, the current scheme
        // gives 10. schema.sql makes the matching correction server-side.
        points: pointsForWordle(!!r.solved, r.guesses ?? MAX_ROWS),
        ts: r.ts ?? Date.now(),
        published: r.published,
      }
    }
    localStorage.setItem(RESULTS_KEY, JSON.stringify(out))
  } catch { /* ignore */ }
  return out
}

function loadResults(): Record<string, GameResult> {
  try {
    const raw = localStorage.getItem(RESULTS_KEY)
    return raw ? JSON.parse(raw) : migrateLegacyResults()
  } catch { return {} }
}
function saveResults(r: Record<string, GameResult>): void {
  try { localStorage.setItem(RESULTS_KEY, JSON.stringify(r)) } catch { /* ignore */ }
}

/**
 * Record a finished game (idempotent per game per day — first result wins,
 * which is also what stops a replay from farming points).
 */
export function recordResult(
  game: GameId, day: number, solved: boolean, guesses: number | null, points: number,
): void {
  const results = loadResults()
  const key = resultKey(day, game)
  if (results[key]) return
  results[key] = { game, day, solved, guesses, points, ts: Date.now() }
  saveResults(results)
}

export function getPlayerResult(day: number, game: GameId): GameResult | null {
  return loadResults()[resultKey(day, game)] ?? null
}

/** Remember that a result made it onto the shared board. */
function markPublished(day: number, game: GameId): void {
  const results = loadResults()
  const key = resultKey(day, game)
  if (!results[key] || results[key].published) return
  results[key] = { ...results[key], published: true }
  saveResults(results)
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

/** Totals for one day across every game the player finished that day. */
function playerDayTotals(day: number): { played: number; wins: number; points: number } {
  let played = 0, wins = 0, points = 0
  for (const r of Object.values(loadResults())) {
    if (r.day !== day) continue
    played++
    if (r.solved) wins++
    points += r.points
  }
  return { played, wins, points }
}

export function getPlayerStats(): PlayerStats {
  const results = Object.values(loadResults())
  let wins = 0, totalPoints = 0
  // A day counts toward a streak if at least one game was solved on it.
  const solvedDays = new Set<number>()
  for (const r of results) {
    totalPoints += r.points
    if (r.solved) { wins++; solvedDays.add(r.day) }
  }

  const solved = [...solvedDays].sort((a, b) => a - b)
  let best = 0, run = 0, prev: number | null = null
  for (const d of solved) {
    run = prev !== null && d === prev + 1 ? run + 1 : 1
    if (run > best) best = run
    prev = d
  }

  // Current streak: consecutive solved days ending at today (or yesterday).
  const today = getDayIndex()
  let current = 0, cursor = solvedDays.has(today) ? today : today - 1
  while (solvedDays.has(cursor)) { current++; cursor-- }

  return {
    played: results.length,
    wins,
    winRate: results.length ? Math.round((wins / results.length) * 100) : 0,
    totalPoints,
    currentStreak: current,
    bestStreak: best,
  }
}

// ── Board rows ──────────────────────────────────────────────────────────────
export interface LeaderRow {
  name: string
  points: number
  detail: string   // e.g. "michezo 3 · ushindi 2"
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

function dayDetail(played: number, wins: number): string {
  return `michezo ${played} · ushindi ${wins}`
}
function seasonDetail(played: number, wins: number): string {
  const rate = played ? Math.round((wins / played) * 100) : 0
  return `michezo ${played} · ushindi ${rate}%`
}

// ── Simulated community ──────────────────────────────────────────────────────
// A fixed roster of players with a per-player skill (0..1). Their daily results
// are derived deterministically from (day, game, seed) so the board is stable.
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

function gameSeed(bot: Bot, day: number, game: GameId): number {
  let h = 0
  for (let i = 0; i < game.length; i++) h = (h * 31 + game.charCodeAt(i)) & 0xffffffff
  return bot.seed ^ (day * 2654435761) ^ h
}

const SKIPPED = { played: false, solved: false, points: 0 }

/** A bot's simulated result for one game on one day. */
function botGame(bot: Bot, day: number, game: GameId): { played: boolean; solved: boolean; points: number } {
  const seed = gameSeed(bot, day, game)
  if (rng(seed * 7) > 0.45 + bot.skill * 0.4) return SKIPPED // didn't play it today
  const solved = rng(seed) < bot.skill

  // The word search and pair match are only ever recorded once completed, so an
  // unsolved one is an abandoned game rather than a scoring result.
  if (game === 'wordsearch') {
    if (!solved) return SKIPPED
    const tiers = [10, 20, 30, 40, 60, 80, 100, 125, 150]
    const i = Math.min(tiers.length - 1, Math.floor(rng(seed * 3) * (2 + bot.skill * 8)))
    return { played: true, solved: true, points: tiers[i] }
  }
  if (game === 'pairmatch') {
    if (!solved) return SKIPPED
    const mistakes = Math.round(rng(seed * 5) * (1 - bot.skill) * 10)
    return { played: true, solved: true, points: pointsForPairMatch(mistakes) }
  }

  // Wordle scores either way; skilled players skew toward fewer guesses.
  if (!solved) return { played: true, solved: false, points: pointsForWordle(false, MAX_ROWS) }
  const spread = rng(seed * 3) * (1 - bot.skill * 0.6)
  const guesses = Math.min(MAX_ROWS, Math.max(2, Math.round(2 + spread * 5)))
  return { played: true, solved: true, points: pointsForWordle(true, guesses) }
}

function botDay(bot: Bot, day: number): { played: number; wins: number; points: number } {
  let played = 0, wins = 0, points = 0
  for (const game of GAME_IDS) {
    const r = botGame(bot, day, game)
    if (!r.played) continue
    played++
    if (r.solved) wins++
    points += r.points
  }
  return { played, wins, points }
}

// ── Public: assembled boards ─────────────────────────────────────────────────
function playerLabel(): string {
  return getPlayerName() || 'You'
}

function rankRows(rows: LeaderRow[]): { rows: LeaderRow[]; playerRank: number | null } {
  rows.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
  const idx = rows.findIndex(r => r.isPlayer)
  return { rows, playerRank: idx >= 0 ? idx + 1 : null }
}

/** Simulated ranked board for a single day (fallback when no backend). */
function getSimulatedDaily(day: number): { rows: LeaderRow[]; playerRank: number | null } {
  const rows: LeaderRow[] = BOTS.map(b => {
    const d = botDay(b, day)
    return { name: b.name, points: d.points, detail: dayDetail(d.played, d.wins), isPlayer: false }
  })

  const mine = playerDayTotals(day)
  if (mine.played > 0) {
    rows.push({ name: playerLabel(), points: mine.points, detail: dayDetail(mine.played, mine.wins), isPlayer: true })
  }
  return rankRows(rows)
}

/** Simulated ranked all-time board over the season (fallback when no backend). */
function getSimulatedAllTime(): { rows: LeaderRow[]; playerRank: number | null } {
  const today = getDayIndex()
  const start = Math.min(LAUNCH_DAY, today)

  const rows: LeaderRow[] = BOTS.map(b => {
    let points = 0, played = 0, wins = 0
    for (let d = start; d <= today; d++) {
      const r = botDay(b, d)
      points += r.points; played += r.played; wins += r.wins
    }
    return { name: b.name, points, detail: seasonDetail(played, wins), isPlayer: false }
  })

  const stats = getPlayerStats()
  rows.push({
    name: playerLabel(),
    points: stats.totalPoints,
    detail: seasonDetail(stats.played, stats.wins),
    isPlayer: true,
  })
  return rankRows(rows)
}

// ── Shared backend (Supabase) ────────────────────────────────────────────────
interface ScoreRow {
  client_id: string
  name: string
  game: GameId
  points: number
  solved: boolean
  guesses: number | null
}

/** Outcome of publishing to the shared board. `ok` is false only on a real
 *  failure — with no backend configured there is nothing to publish. */
export interface SubmitOutcome { ok: boolean; error: string | null }

const NOTHING_TO_DO: SubmitOutcome = { ok: true, error: null }

/** Postgres unique-violation: the row is already on the board, so we're done. */
const UNIQUE_VIOLATION = '23505'

/**
 * Submit one finished game to the shared board (idempotent).
 *
 * A plain INSERT is used rather than an upsert: the board is append-only (the
 * schema grants anon INSERT and SELECT only, with no UPDATE policy), so an
 * upsert's conflict resolution has nothing to fall back on. The unique
 * (client_id, day, game) constraint gives idempotency for free — a repeat
 * submit comes back as 23505, which means the score is already published.
 */
export async function submitResult(day: number, game: GameId): Promise<SubmitOutcome> {
  if (!hasBackend || !supabase) return NOTHING_TO_DO
  const pr = getPlayerResult(day, game)
  if (!pr) return NOTHING_TO_DO

  // Wait for the session so a signed-in player's score is filed under their
  // account id, not the device id it would race to otherwise.
  await identityReady

  const name = (getPlayerName() || 'Anonymous').trim().slice(0, 20) || 'Anonymous'
  try {
    const { error } = await supabase.from('scores').insert({
      client_id: identityId(), name, day, game,
      solved: pr.solved, guesses: pr.guesses, points: pr.points,
    })
    if (!error || error.code === UNIQUE_VIOLATION) {
      markPublished(day, game)
      return NOTHING_TO_DO
    }
    console.warn('submitResult failed:', error.message, error.details ?? '')
    return { ok: false, error: error.message }
  } catch (e) {
    // Network failure — the result stays unpublished and is retried later.
    const message = e instanceof Error ? e.message : String(e)
    console.warn('submitResult failed:', message)
    return { ok: false, error: message }
  }
}

/**
 * Re-send every finished game that never reached the shared board.
 *
 * Without this a single failed submit (offline, a transient error, or playing
 * before the backend was reachable) would drop that result for good: nothing
 * else ever retries, so the player finishes a game and never appears.
 */
export async function syncPendingResults(): Promise<SubmitOutcome> {
  if (!hasBackend || !supabase) return NOTHING_TO_DO
  const pending = Object.values(loadResults())
    .filter(r => !r.published)
    .sort((a, b) => a.day - b.day)

  let error: string | null = null
  for (const r of pending) {
    const outcome = await submitResult(r.day, r.game)
    if (!outcome.ok) error = outcome.error
  }
  return { ok: error === null, error }
}

/** Per-player totals assembled from individual game rows. */
interface Tally { name: string; points: number; played: number; wins: number; isPlayer: boolean }

/** Group rows by player, folding every id this player owns into one entry. */
function tally(
  rows: { client_id: string; name: string; points: number; solved: boolean }[],
  mine: string[],
): Tally[] {
  const MINE = ' me'
  const byPlayer = new Map<string, Tally>()
  for (const r of rows) {
    const isPlayer = mine.includes(r.client_id)
    const key = isPlayer ? MINE : r.client_id
    const entry = byPlayer.get(key) ?? { name: r.name, points: 0, played: 0, wins: 0, isPlayer }
    entry.points += r.points
    entry.played++
    if (r.solved) entry.wins++
    byPlayer.set(key, entry)
  }
  return [...byPlayer.values()]
}

/** Real (or simulated) ranked board for a single day. */
export async function getDailyBoard(day: number): Promise<Board> {
  if (!hasBackend || !supabase) return { ...getSimulatedDaily(day), source: 'local', error: null }

  await identityReady
  const mine = identityIds()
  const { data, error } = await supabase
    .from('scores')
    .select('client_id,name,game,points,solved,guesses')
    .eq('day', day)
  if (error) {
    console.warn('getDailyBoard failed:', error.message)
    return { ...getSimulatedDaily(day), source: 'local', error: error.message }
  }

  const rows: LeaderRow[] = tally(data as ScoreRow[], mine).map(t => ({
    name: t.isPlayer ? (getPlayerName() || t.name) : t.name,
    points: t.points,
    detail: dayDetail(t.played, t.wins),
    isPlayer: t.isPlayer,
  }))

  // The player's own finished games always show, even when the shared board has
  // no rows for them yet — first play of the day, a submit that hasn't landed,
  // or an offline finish. Being told "no scores yet" right after playing is the
  // one thing the board must never do.
  if (!rows.some(r => r.isPlayer)) {
    const totals = playerDayTotals(day)
    if (totals.played > 0) {
      rows.push({
        name: playerLabel(),
        points: totals.points,
        detail: dayDetail(totals.played, totals.wins),
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

  // The view already aggregates per client_id; fold the player's ids together.
  let me: { name: string; points: number; played: number; wins: number } | null = null
  const rows: LeaderRow[] = []
  for (const r of data as AllTimeRow[]) {
    if (mine.includes(r.client_id)) {
      me = me
        ? { name: me.name, points: me.points + r.points, played: me.played + r.played, wins: me.wins + r.wins }
        : { ...r }
      continue
    }
    rows.push({ name: r.name, points: r.points, detail: seasonDetail(r.played, r.wins), isPlayer: false })
  }

  // Same guarantee as the daily board: fall back to the locally recorded season.
  const stats = getPlayerStats()
  if (!me && stats.played > 0) {
    me = { name: playerLabel(), points: stats.totalPoints, played: stats.played, wins: stats.wins }
  }
  if (me) {
    rows.push({
      name: getPlayerName() || me.name,
      points: me.points,
      detail: seasonDetail(me.played, me.wins),
      isPlayer: true,
    })
  }
  return { ...rankRows(rows), source: 'shared', error: null }
}
