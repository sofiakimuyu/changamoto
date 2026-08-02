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

/**
 * Email a six-digit sign-in code to `email`, creating the account if it's new.
 *
 * Whether the player receives a code or a link is decided by the Supabase email
 * template, not by this call: the "Magic Link" template must interpolate
 * `{{ .Token }}`. Left as the stock `{{ .ConfirmationURL }}` this still works,
 * but players get a link and `verifySignInCode` has nothing to accept.
 */
export async function sendSignInCode(email: string): Promise<{ error: string | null }> {
  if (!hasBackend || !supabase) return { error: NO_BACKEND }
  const { error } = await supabase.auth.signInWithOtp({ email: email.trim() })
  return { error: error ? error.message : null }
}

/** Exchange the emailed code for a session. Codes expire after an hour. */
export async function verifySignInCode(email: string, code: string): Promise<{ error: string | null }> {
  if (!hasBackend || !supabase) return { error: NO_BACKEND }
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: code.trim(),
    type: 'email',
  })
  return { error: error ? error.message : null }
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
