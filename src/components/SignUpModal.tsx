import { useState } from 'react'
import { X, Mail, Check, Trophy } from 'lucide-react'
import { sendMagicLink, signOut, useAuth } from '../lib/auth'
import { hasBackend } from '../lib/supabase'
import { getPlayerName, setPlayerName } from '../lib/leaderboard'

// Sign-up / account panel. Passwordless: the player enters a display name and
// email, we send a magic link, and signing in ties their progress + leaderboard
// standing to that account across devices.
export default function SignUpModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const [name, setName] = useState(getPlayerName())
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError('Enter a valid email address.'); return }
    if (name.trim()) setPlayerName(name)       // leaderboard display name
    setBusy(true)
    const { error } = await sendMagicLink(email)
    setBusy(false)
    if (error) setError(error)
    else setSent(true)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-umber-700/50 animate-fade-in p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-sand-100 rounded-3xl p-6 shadow-card animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-ochre-500" />
            <h3 className="text-xl font-black text-umber-700">Track your progress</h3>
          </div>
          <button onClick={onClose} className="text-umber-400"><X className="w-5 h-5" /></button>
        </div>

        {user ? (
          // Already signed in.
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-savanna-100 flex items-center justify-center mx-auto mb-3">
              <Check className="w-7 h-7 text-savanna-600" />
            </div>
            <p className="text-umber-700 font-bold">You’re signed in</p>
            <p className="text-umber-400 text-sm mb-5">{user.email}</p>
            <p className="text-umber-500 text-sm mb-5">Your scores and streaks are saved to your account and count on the leaderboard.</p>
            <button onClick={() => { signOut(); onClose() }}
              className="w-full bg-white border-2 border-sand-200 text-umber-600 font-semibold py-3 rounded-full">
              Sign out
            </button>
          </div>
        ) : sent ? (
          // Magic link sent.
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-cobalt-100 flex items-center justify-center mx-auto mb-3">
              <Mail className="w-7 h-7 text-cobalt-500" />
            </div>
            <p className="text-umber-700 font-bold mb-1">Check your email</p>
            <p className="text-umber-400 text-sm">We sent a sign-in link to <strong>{email}</strong>. Open it on this device to finish.</p>
          </div>
        ) : (
          // Sign-up form.
          <>
            <p className="text-umber-500 text-sm mb-4">
              Save your streaks and climb the leaderboard. No password — we’ll email you a sign-in link.
            </p>
            <label className="block text-[11px] font-bold text-umber-400 uppercase tracking-widest mb-1">Display name</label>
            <input value={name} onChange={e => setName(e.target.value)} maxLength={20} placeholder="How you appear on the board"
              className="w-full px-3 py-2.5 mb-3 rounded-xl border-2 border-sand-200 focus:border-ochre-400 outline-none font-semibold text-umber-700" />
            <label className="block text-[11px] font-bold text-umber-400 uppercase tracking-widest mb-1">Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="you@example.com"
              className="w-full px-3 py-2.5 rounded-xl border-2 border-sand-200 focus:border-ochre-400 outline-none font-semibold text-umber-700" />

            {error && <p className="text-maasai-600 text-sm mt-3">{error}</p>}
            {!hasBackend && (
              <p className="text-umber-400 text-[11px] mt-3 leading-relaxed">
                Note: accounts need the Supabase backend connected. Until then, sign-up is disabled and the
                board shows a simulated field.
              </p>
            )}

            <button onClick={submit} disabled={busy}
              className="w-full btn-primary mt-5 flex items-center justify-center gap-2 disabled:opacity-60">
              <Mail className="w-4 h-4" /> {busy ? 'Sending…' : 'Send sign-in link'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
