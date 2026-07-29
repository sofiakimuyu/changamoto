// Email-based accounts via Supabase Auth (passwordless magic link). Signing in
// gives a player a stable identity so their progress and leaderboard standing
// follow them across devices. All of this is a no-op when the Supabase backend
// isn't configured (see supabase.ts) — the UI checks `hasBackend` first.
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, hasBackend, setAuthUserId } from './supabase'

// Where the magic link returns the player. Uses the app's base path so it works
// both locally and under the GitHub Pages sub-path.
function redirectTo(): string {
  return window.location.origin + import.meta.env.BASE_URL
}

/** Send a passwordless sign-in link to `email`. */
export async function sendMagicLink(email: string): Promise<{ error: string | null }> {
  if (!hasBackend || !supabase) {
    return { error: 'Accounts are not connected yet. Add the Supabase backend to enable sign-up.' }
  }
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: redirectTo() },
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
