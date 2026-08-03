import { useState } from 'react'
import { X, Mail, Check, Trophy, User } from 'lucide-react'
import { sendSignInCode, verifySignInCode, signOut, useAuth, SignUpProfile } from '../lib/auth'
import { navigate } from '../lib/router'
import { hasBackend } from '../lib/supabase'
import { getPlayerName, setPlayerName, getFullName, setFullName } from '../lib/leaderboard'

// Sign-up / account panel. Passwordless: the player gives their name, email and
// a username, we email a six-digit code, and typing it back ties their progress
// + leaderboard standing to that account across devices. Codes rather than links
// because most players are on phones — see the note in lib/auth.ts.
//
// Returning players switch to "Ingia", which asks for the email alone: they
// named themselves when they signed up, and re-typing a username to sign in is
// friction that only ever produces a mismatch.

/** Board-safe handle: letters, numbers and . _ - , 3–20 characters. */
const USERNAME_RE = /^[A-Za-z0-9._-]{3,20}$/

/**
 * Turn an existing board name into a usable username suggestion.
 *
 * Players who set a leaderboard name before usernames existed often have a
 * space in it ("Sofia K"), and offering that back only to reject it reads as the
 * form breaking. Anything left too short is dropped rather than padded.
 */
function suggestUsername(name: string): string {
  const cleaned = name.trim().replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 20)
  return USERNAME_RE.test(cleaned) ? cleaned : ''
}

export default function SignUpModal({ onClose }: { onClose: () => void }) {
  const { member } = useAuth()
  const [mode, setMode] = useState<'signup' | 'signin'>('signup')
  const [fullName, setFullNameField] = useState(getFullName())
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState(() => suggestUsername(getPlayerName()))
  const [code, setCode] = useState('')
  const [stage, setStage] = useState<'form' | 'code'>('form')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signingUp = mode === 'signup'

  /** The details to attach to the account, or undefined when just signing in. */
  const profile = (): SignUpProfile | undefined =>
    signingUp ? { fullName: fullName.trim(), username: username.trim() } : undefined

  const submit = async () => {
    setError(null)
    if (signingUp && fullName.trim().length < 2) { setError('Weka jina lako kamili.'); return }
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError('Weka anwani sahihi ya barua pepe.'); return }
    if (signingUp && !USERNAME_RE.test(username.trim())) {
      setError('Jina la mtumiaji liwe herufi 3 hadi 20 — herufi, namba, nukta, kistari au mstari chini.')
      return
    }

    // Saved before the round trip so the board and profile use them straight
    // away, even if the player never finishes typing the code back.
    if (signingUp) {
      setFullName(fullName)
      setPlayerName(username)   // leaderboard display name
    }

    setBusy(true)
    const { error } = await sendSignInCode(email, profile())
    setBusy(false)
    if (error) setError(error)
    else { setCode(''); setStage('code') }
  }

  // On success `useAuth` sees the new session and this renders the signed-in
  // branch, so there's nothing to set here beyond clearing the busy flag.
  const verify = async () => {
    setError(null)
    if (!/^\d{6}$/.test(code.trim())) { setError('Weka namba ya tarakimu sita.'); return }
    setBusy(true)
    const { error } = await verifySignInCode(email, code, profile())
    setBusy(false)
    if (error) setError('Namba si sahihi au imepitwa na wakati. Jaribu tena.')
  }

  const switchMode = (next: 'signup' | 'signin') => { setMode(next); setError(null) }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-umber-700/50 animate-fade-in p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-sand-100 rounded-3xl p-6 shadow-card animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-ochre-500" />
            <h3 className="text-xl font-black text-umber-700">
              {member ? 'Fuatilia maendeleo yako' : signingUp ? 'Fungua akaunti' : 'Ingia kwenye akaunti'}
            </h3>
          </div>
          <button onClick={onClose} className="text-umber-400"><X className="w-5 h-5" /></button>
        </div>

        {member ? (
          // Already a member — on this device, for good, until they sign out.
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-savanna-100 flex items-center justify-center mx-auto mb-3">
              <Check className="w-7 h-7 text-savanna-600" />
            </div>
            <p className="text-umber-700 font-bold">Umeingia</p>
            <p className="text-umber-400 text-sm mb-5">{member.email}</p>
            <p className="text-umber-500 text-sm mb-5">Alama na mfululizo wako vimehifadhiwa kwenye akaunti yako na vinahesabika kwenye ubao wa viongozi.</p>
            <button onClick={() => { navigate('/profile'); onClose() }}
              className="w-full btn-primary mb-2 flex items-center justify-center gap-2">
              <User className="w-4 h-4" /> Wasifu wangu
            </button>
            <button onClick={() => { signOut(); onClose() }}
              className="w-full bg-white border-2 border-sand-200 text-umber-600 font-semibold py-3 rounded-full">
              Toka
            </button>
          </div>
        ) : stage === 'code' ? (
          // Code sent — type it back here.
          <div className="py-2">
            <div className="w-14 h-14 rounded-full bg-cobalt-100 flex items-center justify-center mx-auto mb-3">
              <Mail className="w-7 h-7 text-cobalt-500" />
            </div>
            <p className="text-umber-700 font-bold text-center mb-1">Angalia barua pepe yako</p>
            <p className="text-umber-400 text-sm text-center mb-4">
              Tumetuma namba ya tarakimu sita kwa <strong>{email}</strong>.
            </p>

            <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" autoFocus
              onKeyDown={e => { if (e.key === 'Enter') verify() }}
              className="w-full px-3 py-3 rounded-xl border-2 border-sand-200 focus:border-ochre-400 outline-none
                         text-center text-2xl font-black tracking-[0.4em] text-umber-700" />

            {error && <p className="text-maasai-600 text-sm mt-3 text-center">{error}</p>}

            <button onClick={verify} disabled={busy}
              className="w-full btn-primary mt-4 flex items-center justify-center gap-2 disabled:opacity-60">
              <Check className="w-4 h-4" /> {busy ? 'Inathibitisha…' : 'Thibitisha'}
            </button>
            <button onClick={() => { setStage('form'); setError(null) }} disabled={busy}
              className="w-full text-umber-400 text-sm mt-3 font-semibold disabled:opacity-60">
              Badilisha barua pepe au utume tena
            </button>
          </div>
        ) : (
          // Sign-up form: name, email, username. Signing in asks the email only.
          <>
            <p className="text-umber-500 text-sm mb-4">
              {signingUp
                ? 'Hifadhi mfululizo wako na upande juu kwenye ubao wa viongozi. Hakuna nywila — tutakutumia namba ya kuingia kwa barua pepe.'
                : 'Karibu tena. Weka barua pepe yako na tutakutumia namba ya kuingia.'}
            </p>

            {signingUp && (
              <>
                <label className="block text-[11px] font-bold text-umber-400 uppercase tracking-widest mb-1" htmlFor="signup-name">
                  Jina
                </label>
                <input id="signup-name" value={fullName} onChange={e => setFullNameField(e.target.value)}
                  maxLength={60} autoComplete="name" placeholder="Jina lako kamili"
                  className="w-full px-3 py-2.5 mb-3 rounded-xl border-2 border-sand-200 focus:border-ochre-400 outline-none font-semibold text-umber-700" />
              </>
            )}

            <label className="block text-[11px] font-bold text-umber-400 uppercase tracking-widest mb-1" htmlFor="signup-email">
              Barua pepe
            </label>
            <input id="signup-email" value={email} onChange={e => setEmail(e.target.value)}
              type="email" autoComplete="email" inputMode="email" placeholder="wewe@mfano.com"
              onKeyDown={e => { if (e.key === 'Enter' && !signingUp) submit() }}
              className="w-full px-3 py-2.5 rounded-xl border-2 border-sand-200 focus:border-ochre-400 outline-none font-semibold text-umber-700" />

            {signingUp && (
              <>
                <label className="block text-[11px] font-bold text-umber-400 uppercase tracking-widest mb-1 mt-3" htmlFor="signup-username">
                  Jina la mtumiaji
                </label>
                <input id="signup-username" value={username} onChange={e => setUsername(e.target.value)}
                  maxLength={20} autoComplete="username" autoCapitalize="none" spellCheck={false}
                  placeholder="Jinsi unavyoonekana ubaoni"
                  onKeyDown={e => { if (e.key === 'Enter') submit() }}
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-sand-200 focus:border-ochre-400 outline-none font-semibold text-umber-700" />
                <p className="text-umber-300 text-[11px] mt-1">Herufi 3–20. Hili ndilo linaloonekana kwenye ubao wa viongozi.</p>
              </>
            )}

            {error && <p className="text-maasai-600 text-sm mt-3">{error}</p>}
            {!hasBackend && (
              <p className="text-umber-400 text-[11px] mt-3 leading-relaxed">
                Kumbuka: akaunti zinahitaji seva ya Supabase iunganishwe. Hadi wakati huo, kujisajili
                kumezimwa na ubao unaonyesha washindani wa kuigiza.
              </p>
            )}

            <button onClick={submit} disabled={busy}
              className="w-full btn-primary mt-5 flex items-center justify-center gap-2 disabled:opacity-60">
              <Mail className="w-4 h-4" /> {busy ? 'Inatuma…' : 'Tuma namba ya kuingia'}
            </button>

            <button onClick={() => switchMode(signingUp ? 'signin' : 'signup')} disabled={busy}
              className="w-full text-umber-400 text-sm mt-3 font-semibold disabled:opacity-60">
              {signingUp ? 'Tayari una akaunti? Ingia' : 'Huna akaunti? Jisajili'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
