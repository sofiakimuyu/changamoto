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
import { supabase, hasBackend, setAuthUserId } from './supabase'

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

export async function signOut(): Promise<void> {
  if (supabase) await supabase.auth.signOut()
}

/** React hook exposing the current signed-in user (or null). */
export function useAuth(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(hasBackend)

  useEffect(() => {
    if (!hasBackend || !supabase) { setLoading(false); return }
    let alive = true

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setUser(data.session?.user ?? null)
      setAuthUserId(data.session?.user?.id ?? null)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setAuthUserId(session?.user?.id ?? null)
    })
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [])

  return { user, loading }
}
