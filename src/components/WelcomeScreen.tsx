import { getDayIndex } from '../lib/wordle'
import { useAuth } from '../lib/auth'

// Wordmark tile colors, cycled across the letters — navy, teal, gold, terracotta.
const TILE_COLORS = ['#34495E', '#4A9E8E', '#D9A93C', '#C05E45']

// First-load splash, mirroring the NYT Wordle welcome: a small tiled logo, the
// stylized wordmark, a one-line pitch, and two ways in — sign in, or just play.
// "Cheza" hands off to the how-to-play screen; "Ingia" opens the account panel,
// or, for a member, "Wasifu" opens their profile — never ask someone who already
// has an account to make one.
export default function WelcomeScreen(
  { onPlay, onLogin, onProfile }: { onPlay: () => void; onLogin: () => void; onProfile: () => void },
) {
  const { user } = useAuth()
  const dayNumber = getDayIndex() - 20657 // human-friendly "edition #" since launch
  const today = new Date().toLocaleDateString('sw', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-sand-100 px-6 animate-fade-in">
      {/* Wordmark as colored letter tiles */}
      <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 mb-6" aria-label="changamoto">
        {'CHANGAMOTO'.split('').map((letter, i) => (
          <span key={i} aria-hidden
            className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center text-white font-black text-lg sm:text-2xl shadow-soft"
            style={{ background: TILE_COLORS[i % TILE_COLORS.length] }}>
            {letter}
          </span>
        ))}
      </div>

      {/* Swahili pitch */}
      <p className="text-center text-2xl sm:text-3xl font-semibold text-umber-700 leading-snug max-w-md mb-8">
        Pata nafasi 6 kubahatisha neno la herufi 5.
      </p>

      {/* Two ways in */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={user ? onProfile : onLogin}
          className="px-8 py-3 rounded-full border-2 border-umber-700 text-umber-700 font-bold active:scale-95 transition-transform">
          {user ? 'Wasifu' : 'Ingia'}
        </button>
        <button onClick={onPlay}
          className="px-10 py-3 rounded-full bg-umber-700 text-white font-bold active:scale-95 transition-transform">
          Cheza
        </button>
      </div>

      {/* Date + edition number */}
      <p className="text-center text-umber-500 font-semibold text-sm">
        {today}
        <br />
        Toleo la #{dayNumber > 0 ? dayNumber : 1}
      </p>
    </div>
  )
}
