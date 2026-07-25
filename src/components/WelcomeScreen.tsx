import { getDayIndex } from '../lib/wordle'

// First-load splash, mirroring the NYT Wordle welcome: a small tiled logo, the
// stylized wordmark, a one-line pitch, and two ways in — sign in, or just play.
// "Cheza" hands off to the how-to-play screen; "Ingia" opens the account panel.
export default function WelcomeScreen({ onPlay, onLogin }: { onPlay: () => void; onLogin: () => void }) {
  const dayNumber = getDayIndex() - 20657 // human-friendly "edition #" since launch
  const today = new Date().toLocaleDateString('sw', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-sand-100 px-6 animate-fade-in">
      {/* Mini tiled mark — the game's board in miniature */}
      <div className="grid grid-cols-3 gap-1 mb-6" aria-hidden>
        {['bg-white','bg-white','bg-white',
          'bg-white','bg-saffron-400','bg-savanna-500',
          'bg-savanna-500','bg-savanna-500','bg-savanna-500'].map((c, i) => (
          <div key={i} className={`w-9 h-9 rounded-md border-2 border-umber-700 ${c}`} />
        ))}
      </div>

      {/* Stylized wordmark */}
      <h1 className="text-5xl sm:text-6xl font-black text-umber-700 tracking-tight lowercase mb-4"
        style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
        changamoto
      </h1>

      {/* Swahili pitch */}
      <p className="text-center text-2xl sm:text-3xl font-semibold text-umber-700 leading-snug max-w-md mb-8">
        Pata nafasi 6 kubahatisha neno la herufi 5.
      </p>

      {/* Two ways in */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onLogin}
          className="px-8 py-3 rounded-full border-2 border-umber-700 text-umber-700 font-bold active:scale-95 transition-transform">
          Ingia
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
