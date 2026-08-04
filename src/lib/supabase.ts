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

// ── Remembered member ────────────────────────────────────────────────────────
// Who this device belongs to, written the moment a session exists and cleared
// only on a real sign-out. Restoring a session needs the network, and a player
// opening the app on a bad connection must not be met with "sign up" — they
// have an account, and this is what the app knows that from before (or without)
// the round trip. It is a memo, not a credential: reading data still needs the
// session, and forging it only mislabels the local UI.
const MEMBER_KEY = 'changamoto_member_v1'

export interface Member { id: string; email: string }

export function getCachedMember(): Member | null {
  try {
    const raw = localStorage.getItem(MEMBER_KEY)
    const m = raw ? JSON.parse(raw) as Member : null
    return m?.id ? m : null
  } catch { return null }
}

/**
 * Forget the stored session on this device.
 *
 * supabase-js keeps the session in storage when it can't reach the server to
 * revoke it, so a player who signs out on a bad connection is signed back in
 * the moment it recovers. Leaving has to be honoured locally whatever the
 * network is doing; the server-side revoke is the part that may fail.
 */
export function clearStoredSession(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('sb-') && key.includes('-auth-token')) localStorage.removeItem(key)
    }
  } catch { /* ignore */ }
}

export function setCachedMember(member: Member | null): void {
  try {
    if (member) localStorage.setItem(MEMBER_KEY, JSON.stringify(member))
    else localStorage.removeItem(MEMBER_KEY)
  } catch { /* ignore */ }
  for (const listener of memberListeners) listener(member)
}

const memberListeners = new Set<(member: Member | null) => void>()

/**
 * Watch who this device belongs to.
 *
 * Every sign-in and sign-out passes through `setCachedMember`, including the
 * local half of a sign-out that can't reach the server — which is the case a
 * Supabase auth event alone would miss, leaving the UI showing a player as
 * signed in after they asked to leave.
 */
export function onMemberChange(listener: (member: Member | null) => void): () => void {
  memberListeners.add(listener)
  return () => { memberListeners.delete(listener) }
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
//
// Seeded from the remembered member so that a session which can't be restored
// right now still files today's games under the player's account rather than
// splitting their season across two ids.
let authUserId: string | null = getCachedMember()?.id ?? null

export function setAuthUserId(id: string | null): void { authUserId = id }
export function getAuthUserId(): string | null { return authUserId }

/** Every id this player's rows may have been written under, best match first. */
export function identityIds(): string[] {
  const device = getClientId()
  return authUserId && authUserId !== device ? [authUserId, device] : [device]
}

/** The id new rows are written under. */
export function identityId(): string { return authUserId ?? getClientId() }

/**
 * How long to wait for the session before falling back to the remembered id.
 *
 * supabase-js retries a failing token refresh for about thirty seconds, and
 * every score submit and board read waits on this promise first. Capping the
 * wait is only safe when the remembered member already gives the same answer
 * the session would — without one, waiting is what stops a signed-in player's
 * game being filed under the device id and split from the rest of their season.
 */
const IDENTITY_TIMEOUT_MS = 4000

/** Resolves once the auth session (if any) has been restored — or, for a player
 *  we already recognise, once waiting for it stops being worth it. */
export const identityReady: Promise<void> = supabase
  ? (() => {
      const restored = supabase.auth.getSession()
        .then(({ data }) => { if (data.session?.user) rememberSession(data.session.user) })
        .catch(() => { /* keep the remembered member; the session may come back */ })
      if (!authUserId) return restored
      return Promise.race([
        restored,
        new Promise<void>(resolve => setTimeout(resolve, IDENTITY_TIMEOUT_MS)),
      ])
    })()
  : Promise.resolve()

function rememberSession(user: { id: string; email?: string }): void {
  setAuthUserId(user.id)
  setCachedMember({ id: user.id, email: user.email ?? '' })
}

// Keep the identity current as the player signs in or out.
//
// Only an explicit SIGNED_OUT forgets the player. Every other way a session can
// come back empty — a failed refresh, an unreachable backend, a read that threw
// — is a temporary loss of proof, not a sign-out, and dropping the identity
// there would file the player's next game under a stranger's id.
supabase?.auth.onAuthStateChange((event, session) => {
  if (session?.user) rememberSession(session.user)
  else if (event === 'SIGNED_OUT') { setAuthUserId(null); setCachedMember(null) }
})
