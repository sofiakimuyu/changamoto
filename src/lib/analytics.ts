// Anonymous usage analytics for Changamoto. Answers the two product questions:
// "how many people use it?" (unique devices / active users) and "how often?"
// (sessions, plays, returning-day engagement).
//
// ── How it works ────────────────────────────────────────────────────────────
// Every meaningful action fires a lightweight event to the shared Supabase
// `events` table (see supabase/analytics.sql). Events are tied to:
//   • client_id  — a stable per-device id (see supabase.ts), = a "user".
//   • session_id — a fresh id per browsing session (tab, ~30 min idle), = a
//     "visit", so we can count how often a device comes back.
// No personal data is collected. When Supabase isn't configured the tracker is
// a no-op, so local dev and previews run without a backend.

import { supabase, hasBackend, getClientId } from './supabase'

const SESSION_KEY = 'changamoto_session'
const SESSION_TTL_MS = 30 * 60 * 1000 // a gap longer than this starts a new session

type StoredSession = { id: string; last: number }

function newId(): string {
  return crypto?.randomUUID?.() ?? `s_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

// Returns the current session id, rotating it after 30 min of inactivity. Kept
// in localStorage (not sessionStorage) so a quick reload counts as one session
// while a return hours later counts as a new one.
function getSessionId(): string {
  try {
    const now = Date.now()
    const raw = localStorage.getItem(SESSION_KEY)
    let s: StoredSession | null = raw ? JSON.parse(raw) : null
    const fresh = !s || now - s.last > SESSION_TTL_MS
    if (fresh) s = { id: newId(), last: now }
    else s!.last = now
    localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    return s!.id
  } catch {
    return 'no-session'
  }
}

/** Was the current session started on this call (i.e. a brand-new visit)? */
function isNewSession(): boolean {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return true
    const s: StoredSession = JSON.parse(raw)
    return Date.now() - s.last > SESSION_TTL_MS
  } catch {
    return false
  }
}

interface EventFields {
  path?: string
  game?: string
  props?: Record<string, unknown>
}

/** Fire-and-forget: record one usage event. Never throws, never blocks the UI. */
export function track(name: string, fields: EventFields = {}): void {
  if (!hasBackend || !supabase) return
  const row = {
    client_id: getClientId(),
    session_id: getSessionId(),
    name,
    path: fields.path ?? null,
    game: fields.game ?? null,
    props: fields.props ?? {},
  }
  // Don't await — analytics must not slow down or break gameplay.
  supabase.from('events').insert(row).then(({ error }) => {
    if (error) console.warn('analytics track failed:', error.message)
  })
}

/** Map a hash route to a stable game key for per-game reporting. */
export function gameKeyForRoute(route: string): string | undefined {
  const m = route.match(/^\/wordle\/(\d)$/)
  if (m) return `wordle-${m[1]}`
  if (route === '/' || route === '') return 'wordle-5'
  if (route === '/wordsearch') return 'wordsearch'
  if (route === '/pairmatch') return 'pairmatch'
  return undefined
}

/** Call once on app load: opens a session (first visit only) + first page view. */
export function initAnalytics(route: string): void {
  if (!hasBackend) return
  if (isNewSession()) track('session_start')
  trackPageView(route)
}

let lastPath: string | null = null

/** Record a page view, de-duplicating repeats of the same route. */
export function trackPageView(route: string): void {
  const path = route || '/'
  if (path === lastPath) return
  lastPath = path
  track('page_view', { path, game: gameKeyForRoute(path) })
}

/** Record that a game was opened (once per page open). */
export function trackGameStart(game: string, path: string): void {
  track('game_start', { game, path })
}

/** Record that a game finished, with its outcome. */
export function trackGameComplete(game: string, props: Record<string, unknown>): void {
  track('game_complete', { game, props })
}
