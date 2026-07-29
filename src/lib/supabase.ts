// Supabase client for the shared leaderboard. Credentials come from Vite env
// vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY), which are safe to ship in a
// static client: the anon key only grants what Row Level Security allows (see
// supabase/schema.sql). When the vars are absent the app runs in a local-only
// fallback mode, so development and previews work without a backend.
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** True when a Supabase backend is configured; drives real vs. simulated board. */
export const hasBackend = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = hasBackend
  ? createClient(url!, anonKey!, {
      auth: {
        // Persist the login so accounts follow the player across reloads.
        persistSession: true,
        autoRefreshToken: true,
        // PKCE puts the magic-link code in the query string (?code=), not the
        // URL hash, so it never collides with our hash-based router.
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null

// ── Anonymous device identity ────────────────────────────────────────────────
// No login: each device gets a stable random id kept in localStorage. It ties a
// player's daily rows together for all-time totals without any account.
const CLIENT_ID_KEY = 'changamoto_client_id'

export function getClientId(): string {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY)
    if (!id) {
      id = (crypto?.randomUUID?.() ?? `c_${Date.now()}_${Math.random().toString(36).slice(2)}`)
      localStorage.setItem(CLIENT_ID_KEY, id)
    }
    return id
  } catch {
    return 'anonymous'
  }
}

// ── Leaderboard identity ─────────────────────────────────────────────────────
// A signed-in player is identified by their auth user id (so progress follows
// them across devices); otherwise the anonymous device id is used.
//
// The session is restored asynchronously, so anything that writes or matches a
// score must first await `identityReady` — otherwise a signed-in player's score
// races the session restore and lands under the device id instead, and their
// own row never gets recognised on the board. Resolving it here (at module
// load) rather than inside a component means the identity is settled on every
// route, including a cold load straight into #/leaderboard.
let authUserId: string | null = null

export function setAuthUserId(id: string | null): void { authUserId = id }
export function getAuthUserId(): string | null { return authUserId }

/** Every id this player's rows may have been written under, best match first. */
export function identityIds(): string[] {
  const device = getClientId()
  return authUserId && authUserId !== device ? [authUserId, device] : [device]
}

/** The id new rows are written under. */
export function identityId(): string { return authUserId ?? getClientId() }

/** Resolves once the auth session (if any) has been restored. */
export const identityReady: Promise<void> = supabase
  ? supabase.auth.getSession()
      .then(({ data }) => { setAuthUserId(data.session?.user?.id ?? null) })
      .catch(() => { /* stay anonymous */ })
  : Promise.resolve()

// Keep the identity current as the player signs in or out.
supabase?.auth.onAuthStateChange((_event, session) => {
  setAuthUserId(session?.user?.id ?? null)
})
