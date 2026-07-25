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
import { supabase, hasBackend, getClientId } from './supabase'

// When a player signs in, their auth user id becomes their leaderboard identity
// (so progress follows them across devices); otherwise the anonymous device id
// is used. Kept in a module var, updated by the auth listener.
let authUserId: string | null = null
export function setAuthUserId(id: string | null) { authUserId = id }
function identityId(): string { return authUserId ?? getClientId() }

const NAME_KEY = 'changamoto_player_name'
const RESULTS_KEY = 'changamoto_daily_results_v2'
const RESULTS_KEY_V1 = 'changamoto_daily_results_v1'

// First day the all-time season counts from (the app's launch day index).
export const LAUNCH_DAY = 20658 // 2026-07-24

// The featured daily game whose head-to-head board is shown on the "Leo" tab.
export const FEATURED_GAME = 'wordle-5'

// Every game that can earn leaderboard points. Wordles are scored by guesses;
// the completion games award a flat bonus for finishing the daily puzzle.
export function wordleGame(len: number): string { return `wordle-${len}` }
export const WORDSEARCH_GAME = 'wordsearch'
export const MATCH_GAME = 'match'
// Flat points for finishing the two completion games (no guess/loss scale).
export const WORDSEARCH_POINTS = 100
export const MATCH_POINTS = 60

export interface DailyResult {
  day: number
  game: string    // e.g. "wordle-5", "wordsearch", "match"
  solved: boolean
  guesses: number // guesses used for wordles; 0 for completion games
  points: number
  ts: number
}

export interface LeaderRow {
  name: string
  points: number
  detail: string   // e.g. "3/6" for a day, or "12 played · 78% win" all-time
  isPlayer: boolean
}

// ── Scoring ───────────────────────────────────────────────────────────────
/**
 * Points for a finished wordle. Fewer guesses → more points; even a loss earns
 * a small participation reward for showing up.
 *   solved in 1 guess → 150; 2→100, 3→80, 4→60, 5→40, 6→20; a loss → 5.
 */
export function pointsFor(solved: boolean, guesses: number): number {
  if (!solved) return 5 // participation points, even without a correct guess
  if (guesses <= 1) return 150 // ace bonus for a first-guess solve
  return Math.max(20, (MAX_ROWS - guesses + 1) * 20)
}

// ── Player identity ─────────────────────────────────────────────────────────
export function getPlayerName(): string {
  try { return localStorage.getItem(NAME_KEY) || '' } catch { return '' }
}
export function setPlayerName(name: string): void {
  try { localStorage.setItem(NAME_KEY, name.trim().slice(0, 20)) } catch { /* ignore */ }
}

// ── Result persistence ──────────────────────────────────────────────────────
// Results are keyed by `${day}:${game}`, so every game earns points on its own
// (one result per game per day). Older versions stored one result per day for
// the 5-letter wordle only; that history is migrated forward on first load.
function resultKey(day: number, game: string): string { return `${day}:${game}` }

function migrateV1(): Record<string, DailyResult> | null {
  try {
    const raw = localStorage.getItem(RESULTS_KEY_V1)
    if (!raw) return null
    const old = JSON.parse(raw) as Record<number, { day: number; solved: boolean; guesses: number; points: number; ts: number }>
    const out: Record<string, DailyResult> = {}
    for (const v of Object.values(old)) {
      out[resultKey(v.day, FEATURED_GAME)] = { ...v, game: FEATURED_GAME }
    }
    return out
  } catch { return null }
}

function loadResults(): Record<string, DailyResult> {
  try {
    const raw = localStorage.getItem(RESULTS_KEY)
    if (raw) return JSON.parse(raw)
    // No v2 store yet — migrate any v1 history so streaks/points carry over.
    const migrated = migrateV1()
    if (migrated) { saveResults(migrated); return migrated }
    return {}
  } catch { return {} }
}
function saveResults(r: Record<string, DailyResult>): void {
  try { localStorage.setItem(RESULTS_KEY, JSON.stringify(r)) } catch { /* ignore */ }
}

/** Record a finished wordle (idempotent per game/day — first result wins). */
export function recordDaily(day: number, solved: boolean, guesses: number, game = FEATURED_GAME): void {
  const results = loadResults()
  const key = resultKey(day, game)
  if (results[key]) return
  results[key] = { day, game, solved, guesses, points: pointsFor(solved, guesses), ts: Date.now() }
  saveResults(results)
}

/** Record a finished completion game (word search, pair match) for flat points. */
export function recordCompletion(day: number, game: string, points: number): void {
  const results = loadResults()
  const key = resultKey(day, game)
  if (results[key]) return
  results[key] = { day, game, solved: true, guesses: 0, points, ts: Date.now() }
  saveResults(results)
}

/** All of the player's game results for a given day. */
export function getPlayerDayResults(day: number): DailyResult[] {
  return Object.values(loadResults()).filter(r => r.day === day)
}

/** The featured daily-wordle result for a day (drives the "Leo" board). */
export function getPlayerResult(day: number): DailyResult | null {
  return loadResults()[resultKey(day, FEATURED_GAME)] ?? null
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
  // Every game played (across all wordles + completion games) earns points.
  const all = Object.values(loadResults())
  let wins = 0, totalPoints = 0
  for (const r of all) { if (r.solved) wins++; totalPoints += r.points }

  // Streaks count consecutive calendar days with at least one solved game.
  const solvedDays = [...new Set(all.filter(r => r.solved).map(r => r.day))].sort((a, b) => a - b)
  const solvedSet = new Set(solvedDays)
  let best = 0, run = 0, prev: number | null = null
  for (const d of solvedDays) {
    if (prev !== null && d === prev + 1) run++
    else run = 1
    if (run > best) best = run
    prev = d
  }
  // Current streak: consecutive solved days ending at today (or yesterday).
  const today = getDayIndex()
  let current = 0, cursor = solvedSet.has(today) ? today : today - 1
  while (solvedSet.has(cursor)) { current++; cursor-- }

  return {
    played: all.length,
    wins,
    winRate: all.length ? Math.round((wins / all.length) * 100) : 0,
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
  if (!solved) return { solved: false, guesses: MAX_ROWS, points: pointsFor(false, MAX_ROWS) }
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
interface ScoreRow { client_id: string; name: string; game: string; points: number; solved: boolean; guesses: number }

/** Submit all of the player's finished results for a day (idempotent per game). */
export async function submitDaily(day: number): Promise<void> {
  if (!hasBackend || !supabase) return
  const results = getPlayerDayResults(day)
  if (results.length === 0) return
  const name = getPlayerName() || 'Anonymous'
  const client_id = identityId()
  // First result per device/day/game wins — ignore conflicts on re-submit.
  const { error } = await supabase
    .from('scores')
    .upsert(
      results.map(r => ({ client_id, name, day, game: r.game, solved: r.solved, guesses: r.guesses, points: r.points })),
      { onConflict: 'client_id,day,game', ignoreDuplicates: true },
    )
  if (error) console.warn('submitDaily failed:', error.message)
}

function rankRows(rows: LeaderRow[]): { rows: LeaderRow[]; playerRank: number | null } {
  rows.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
  const idx = rows.findIndex(r => r.isPlayer)
  return { rows, playerRank: idx >= 0 ? idx + 1 : null }
}

/** Real (or simulated) ranked board for a single day. */
export async function getDailyBoard(day: number): Promise<{ rows: LeaderRow[]; playerRank: number | null }> {
  if (!hasBackend || !supabase) return getSimulatedDaily(day)

  const me = identityId()
  // The "Leo" board is head-to-head on the featured daily wordle only.
  const { data, error } = await supabase
    .from('scores')
    .select('client_id,name,points,solved,guesses')
    .eq('day', day)
    .eq('game', FEATURED_GAME)
    .order('points', { ascending: false })
  if (error) { console.warn('getDailyBoard failed:', error.message); return getSimulatedDaily(day) }

  const rows: LeaderRow[] = (data as ScoreRow[]).map(r => ({
    name: r.client_id === me ? (getPlayerName() || r.name) : r.name,
    points: r.points,
    detail: r.solved ? `${r.guesses}/${MAX_ROWS}` : 'X/6',
    isPlayer: r.client_id === me,
  }))
  return rankRows(rows)
}

/** Real (or simulated) ranked all-time board. */
export async function getAllTimeBoard(): Promise<{ rows: LeaderRow[]; playerRank: number | null }> {
  if (!hasBackend || !supabase) return getSimulatedAllTime()

  const me = identityId()
  const { data, error } = await supabase
    .from('alltime_leaderboard')
    .select('client_id,name,points,played,wins')
    .order('points', { ascending: false })
  if (error) { console.warn('getAllTimeBoard failed:', error.message); return getSimulatedAllTime() }

  const rows: LeaderRow[] = (data as { client_id: string; name: string; points: number; played: number; wins: number }[])
    .map(r => {
      const winRate = r.played ? Math.round((r.wins / r.played) * 100) : 0
      return {
        name: r.client_id === me ? (getPlayerName() || r.name) : r.name,
        points: r.points,
        detail: `${r.played} played · ${winRate}% win`,
        isPlayer: r.client_id === me,
      }
    })
  return rankRows(rows)
}
