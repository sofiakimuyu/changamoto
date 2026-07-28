import { useEffect, useState } from 'react'
import { Share2, Grid3x3, Trophy } from 'lucide-react'
import { navigate } from '../lib/router'
import { useAuth } from '../lib/auth'
import { playWin } from '../lib/sound'
import Confetti from './Confetti'
import SignUpModal from './SignUpModal'

// Shared celebration sheet shown after any non-Wordle game win. Mirrors the
// Wordle result sheet's finish options — share, sign up, view the leaderboard,
// and play more games — so every win offers the same next steps.
interface Props {
  emoji: string
  title: string
  subtitle: string
  shareText: string
  onClose?: () => void
}

export default function WinSheet({ emoji, title, subtitle, shareText, onClose }: Props) {
  const { user } = useAuth()
  const [showSignup, setShowSignup] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // The sheet only mounts once a game is won, so play the win cue on mount.
  // Wordle has its own result sheet and triggers the cue separately.
  useEffect(() => { playWin() }, [])

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 1400) }

  const share = async () => {
    const url = 'https://sofiakimuyu.github.io/changamoto/'
    try {
      if (navigator.share) { await navigator.share({ title: 'Changamoto', text: `${shareText}\n`, url }); return }
    } catch { /* cancelled — fall through to clipboard */ }
    try {
      await navigator.clipboard.writeText(`${shareText}\n${url}`)
      flash('Imenakiliwa')
    } catch { flash('Kushiriki hakutumiki') }
  }

  return (
    <>
      <Confetti />
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-umber-700/40 animate-fade-in"
        onClick={onClose}>
        <div className="w-full max-w-md bg-sand-100 rounded-t-3xl p-5 pb-8 shadow-card animate-slide-up max-h-[88vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}>
          <div className="w-10 h-1 bg-sand-300 rounded-full mx-auto mb-4"/>

          {/* Toast */}
          <div className="h-7 flex items-center justify-center">
            {toast && (
              <div className="bg-umber-700 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-card animate-fade-in">
                {toast}
              </div>
            )}
          </div>

          <div className="text-center mb-5">
            <div className="text-6xl mb-2">{emoji}</div>
            <h3 className="text-3xl font-black text-umber-700">{title}</h3>
            <p className="text-umber-400 text-sm">{subtitle}</p>
          </div>

          {/* Finish options: Share · Sign up · Leaderboard · Play more games */}
          <div className="space-y-2.5">
            <button onClick={share}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-full font-bold btn-primary">
              <Share2 className="w-5 h-5"/> Shiriki
            </button>
            {user ? (
              // Already signed in — go straight to standings instead of signing up.
              <button onClick={() => navigate('/leaderboard')}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-full font-bold bg-cobalt-500 text-white active:scale-95 transition-transform">
                <Trophy className="w-5 h-5"/> Tazama ubao wa viongozi
              </button>
            ) : (
              <>
                <button onClick={() => setShowSignup(true)}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-full font-bold bg-cobalt-500 text-white active:scale-95 transition-transform">
                  <Trophy className="w-5 h-5"/> Jisajili kufuatilia maendeleo
                </button>
                <button onClick={() => navigate('/leaderboard')}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-full font-semibold bg-white border-2 border-sand-200 text-umber-600 active:scale-95 transition-transform">
                  <Trophy className="w-5 h-5"/> Tazama ubao wa viongozi
                </button>
              </>
            )}
            <button onClick={() => navigate('/games')}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-full font-semibold bg-white border-2 border-sand-200 text-umber-600 active:scale-95 transition-transform">
              <Grid3x3 className="w-5 h-5"/> Cheza michezo zaidi
            </button>
          </div>
        </div>
      </div>

      {showSignup && <SignUpModal onClose={() => setShowSignup(false)} />}
    </>
  )
}
