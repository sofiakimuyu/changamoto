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
