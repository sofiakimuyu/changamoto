// Email-based accounts via Supabase Auth (passwordless six-digit code). Signing
// in gives a player a stable identity so their progress and leaderboard standing
// follow them across devices. All of this is a no-op when the Supabase backend
// isn't configured (see supabase.ts) — the UI checks `hasBackend` first.
//
// A typed code rather than a magic link, deliberately. A link opened from a
// phone's mail app lands in that app's in-app browser, which has its own
// localStorage — so the PKCE verifier written when the code was requested isn't
// there and the exchange fails. Most of our players are on phones, so the link
// flow silently lost a large share of sign-ins. A code is read and re-typed in
// the browser that started the flow, so the session lands where the player
// actually is. Sending the code costs exactly what sending a link did.
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  supabase, hasBackend, setAuthUserId, getCachedMember, setCachedMember,
  clearStoredSession, onMemberChange, Member,
} from './supabase'

const NO_BACKEND = 'Accounts are not connected yet. Add the Supabase backend to enable sign-up.'

/** What a new player tells us about themselves when creating an account. */
export interface SignUpProfile {
  /** The player's real name. Kept on the account; never shown on the board. */
  fullName: string
  /** Public handle — what the leaderboard prints. */
  username: string
}

/**
 * Email a six-digit sign-in code to `email`, creating the account if it's new.
 *
 * Whether the player receives a code or a link is decided by the Supabase email
 * template, not by this call: the "Magic Link" template must interpolate
 * `{{ .Token }}`. Left as the stock `{{ .ConfirmationURL }}` this still works,
 * but players get a link and `verifySignInCode` has nothing to accept.
 *
 * `profile` is passed for a sign-up and omitted for a returning player. Supabase
 * only applies `options.data` when it actually creates the user, so this cannot
 * overwrite an existing account's details — `saveProfile` below handles the
 * already-a-member case, once there's a session to write with.
 */
export async function sendSignInCode(
  email: string, profile?: SignUpProfile,
): Promise<{ error: string | null }> {
  if (!hasBackend || !supabase) return { error: NO_BACKEND }
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: profile
      ? { data: { full_name: profile.fullName, username: profile.username } }
      : undefined,
  })
  return { error: error ? error.message : null }
}

/**
 * Exchange the emailed code for a session. Codes expire after an hour.
 *
 * A `profile` is written onto the account after a successful verify, so a player
 * who signs up with an email that already has an account still gets the name and
 * username they just typed.
 */
export async function verifySignInCode(
  email: string, code: string, profile?: SignUpProfile,
): Promise<{ error: string | null }> {
  if (!hasBackend || !supabase) return { error: NO_BACKEND }
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: code.trim(),
    type: 'email',
  })
  if (error) return { error: error.message }
  if (profile) await saveProfile(profile)
  return { error: null }
}

/**
 * Store the player's name and username on their account.
 *
 * Best-effort: the names are already saved locally and the board reads them from
 * there, so a failure here costs nothing the player can see.
 */
export async function saveProfile(profile: SignUpProfile): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.auth.updateUser({
    data: { full_name: profile.fullName, username: profile.username },
  })
  if (error) console.warn('saveProfile failed:', error.message)
}

/** How long a sign-out waits for the server before finishing without it. */
const REVOKE_GRACE_MS = 2500

/**
 * Sign out on this device, and revoke on the server when it can be reached.
 *
 * Leaving is local first and unconditional. supabase-js keeps the stored
 * session whenever its revoke call fails — and on a bad connection that call
 * sits in retry backoff for seconds — so waiting on it means a player taps
 * "Toka", sees nothing happen, and is signed back in when the network returns.
 */
export async function signOut(): Promise<void> {
  setCachedMember(null)   // notifies the UI immediately
  setAuthUserId(null)
  if (!supabase) return

  const revoke = supabase.auth.signOut().then(() => undefined, () => undefined)
  // The revoke can refresh the session on its way out, writing it back after
  // we've cleared it, so clear again once it settles.
  void revoke.then(dropStoredSession)
  await Promise.race([revoke, new Promise(r => setTimeout(r, REVOKE_GRACE_MS))])
  dropStoredSession()
}

/** Drop the stored session unless someone has signed in since — a fresh
 *  session belongs to whoever just signed in, not to the sign-out that left. */
function dropStoredSession(): void {
  if (!getCachedMember()) clearStoredSession()
}

/**
 * The player's account state.
 *
 * `member` is the durable answer to "does this person have an account" — it is
 * known synchronously on the first render, survives a backend that can't be
 * reached, and is what the UI should branch on. `user` is the live session, and
 * is null until it has been restored (and while it can't be), so anything
 * needing a token — not the app's own UI — should use that.
 */
export function useAuth(): { user: User | null; member: Member | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null)
  const [member, setMember] = useState<Member | null>(() => getCachedMember())
  // A remembered member has nothing to wait for: the UI already knows who they
  // are, and holding it back only shows a returning player an empty top bar.
  const [loading, setLoading] = useState(hasBackend && !getCachedMember())

  useEffect(() => {
    // supabase.ts keeps the remembered member current for every auth event, so
    // following it here covers signing in, signing out, and a sign-out that
    // never reached the server.
    const unwatch = onMemberChange(setMember)
    if (!hasBackend || !supabase) { setLoading(false); return unwatch }
    let alive = true

    supabase.auth.getSession()
      .then(({ data }) => { if (alive) setUser(data.session?.user ?? null) })
      // Never leave `loading` set: everything that tells a player where they
      // stand is gated on it, and a session read that fails must not blank the
      // account controls for the rest of the visit.
      .catch(() => { /* the remembered member still stands */ })
      .finally(() => { if (alive) setLoading(false) })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    return () => { alive = false; unwatch(); sub.subscription.unsubscribe() }
  }, [])

  return { user, member, loading }
}
