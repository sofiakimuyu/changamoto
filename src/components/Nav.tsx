import { useState } from 'react'
import { Trophy, BookOpen, Flag, Grid3x3, BarChart3, X } from 'lucide-react'
import { navigate } from '../lib/router'

// Where "Report issue" points. A GitHub issue is the simplest durable channel
// for a static site; swap for a form or mailto if you prefer.
const REPORT_URL = 'https://github.com/sofiakimuyu/changamoto/issues/new?title=Issue%20report&labels=player-report'

function NavButton({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-2 rounded-full text-umber-600 hover:bg-sand-200 active:scale-95 transition-all text-sm font-semibold">
      {icon}<span className="hidden sm:inline">{label}</span>
    </button>
  )
}

export default function Nav() {
  const [showRules, setShowRules] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-40 bg-sand-100/90 backdrop-blur border-b border-sand-200">
        <div className="beadwork-stripe opacity-70"/>
        <div className="max-w-3xl mx-auto flex items-center justify-between px-3 py-2 gap-1">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 active:scale-95 transition-transform">
            <span className="text-2xl">🟩</span>
            <span className="font-black text-umber-700 text-lg tracking-tight">Changamoto</span>
          </button>
          <nav className="flex items-center gap-0.5">
            <NavButton onClick={() => navigate('/games')} icon={<Grid3x3 className="w-4 h-4"/>} label="Michezo zaidi" />
            <NavButton onClick={() => navigate('/leaderboard')} icon={<Trophy className="w-4 h-4"/>} label="Viongozi" />
            <NavButton onClick={() => navigate('/analytics')} icon={<BarChart3 className="w-4 h-4"/>} label="Takwimu" />
            <NavButton onClick={() => setShowRules(true)} icon={<BookOpen className="w-4 h-4"/>} label="Jinsi ya kucheza" />
            <a href={REPORT_URL} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-umber-600 hover:bg-sand-200 active:scale-95 transition-all text-sm font-semibold">
              <Flag className="w-4 h-4"/><span className="hidden sm:inline">Ripoti tatizo</span>
            </a>
          </nav>
        </div>
      </header>

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </>
  )
}

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-umber-700/40 animate-fade-in p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-sand-100 rounded-3xl p-6 shadow-card animate-slide-up max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-black text-umber-700">Jinsi ya kucheza</h3>
          <button onClick={onClose} className="text-umber-400"><X className="w-5 h-5"/></button>
        </div>

        <p className="text-umber-600 mb-4">
          Bahatisha neno la Kiswahili kwa majaribio 6. Kila jaribio lazima liwe neno halisi la Kiswahili
          lenye urefu sahihi. Baada ya kila jaribio, vigae hubadilika rangi:
        </p>

        <div className="space-y-2.5 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-savanna-500 flex items-center justify-center text-white font-black">S</div>
            <p className="text-umber-600 text-sm"><strong>Kijani</strong> — herufi sahihi, nafasi sahihi.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-saffron-400 flex items-center justify-center text-white font-black">A</div>
            <p className="text-umber-600 text-sm"><strong>Njano</strong> — imo nenoni, nafasi si sahihi.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-umber-300 flex items-center justify-center text-white font-black">O</div>
            <p className="text-umber-600 text-sm"><strong>Kijivu</strong> — haimo nenoni.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 mb-3 shadow-soft">
          <p className="text-[11px] font-bold text-umber-400 uppercase tracking-widest mb-1.5">Neno moja kwa siku</p>
          <p className="text-umber-600 text-sm leading-relaxed">
            Mchezo wa nyumbani ni neno jipya la herufi 5 kila siku — neno moja kwa kila mtu. Litatue kwa
            majaribio machache uwezavyo ili upande juu kwenye ubao wa viongozi.
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-soft">
          <p className="text-[11px] font-bold text-umber-400 uppercase tracking-widest mb-1.5">Michezo zaidi</p>
          <p className="text-umber-600 text-sm leading-relaxed">
            Unataka zaidi? Cheza Wordle ya herufi 3, 4 na 6, tafuta-maneno ya kila siku, na mchezo wa
            kuoanisha kwenye ukurasa wa <button onClick={() => { onClose(); navigate('/games') }} className="text-ochre-500 font-bold underline">Michezo zaidi</button>.
          </p>
        </div>
      </div>
    </div>
  )
}
