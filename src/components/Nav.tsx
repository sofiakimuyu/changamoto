import { useState } from 'react'
import { Trophy, BookOpen, Flag, Grid3x3, User, LogIn } from 'lucide-react'
import { navigate } from '../lib/router'
import { useAuth } from '../lib/auth'
import HowToPlay from './HowToPlay'
import SignUpModal from './SignUpModal'

// Where "Report issue" points. A GitHub issue is the simplest durable channel
// for a static site; swap for a form or mailto if you prefer.
const REPORT_URL = 'https://github.com/sofiakimuyu/changamoto/issues/new?title=Issue%20report&labels=player-report'

function NavButton({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-full text-umber-600 hover:bg-sand-200 active:scale-95 transition-all text-sm font-semibold">
      {icon}<span className="hidden lg:inline whitespace-nowrap">{label}</span>
    </button>
  )
}

export default function Nav() {
  const [showRules, setShowRules] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  // A member gets their profile in the top bar; everyone else gets the way in.
  const { member, loading } = useAuth()

  return (
    <>
      <header className="sticky top-0 z-40 bg-sand-100/90 backdrop-blur border-b border-sand-200">
        <div className="beadwork-stripe opacity-70"/>
        <div className="max-w-3xl mx-auto flex items-center justify-between px-3 py-2 gap-1">
          <button onClick={() => navigate('/')} className="flex items-center gap-1.5 shrink-0 active:scale-95 transition-transform">
            <span className="text-xl sm:text-2xl">🟩</span>
            <span className="font-black text-umber-700 text-base sm:text-lg tracking-tight whitespace-nowrap">Changamoto</span>
          </button>
          <nav className="flex items-center gap-0.5">
            {/* Hidden until the session is known, so the bar doesn't flash the
                wrong option to a signed-in player on load. */}
            {(member || !loading) && (member
              ? <NavButton onClick={() => navigate('/profile')} icon={<User className="w-4 h-4"/>} label="Wasifu" />
              : <NavButton onClick={() => setShowLogin(true)} icon={<LogIn className="w-4 h-4"/>} label="Ingia" />
            )}
            <NavButton onClick={() => navigate('/games')} icon={<Grid3x3 className="w-4 h-4"/>} label="Michezo zaidi" />
            <NavButton onClick={() => navigate('/leaderboard')} icon={<Trophy className="w-4 h-4"/>} label="Viongozi" />
            <NavButton onClick={() => setShowRules(true)} icon={<BookOpen className="w-4 h-4"/>} label="Jinsi ya kucheza" />
            <a href={REPORT_URL} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-full text-umber-600 hover:bg-sand-200 active:scale-95 transition-all text-sm font-semibold">
              <Flag className="w-4 h-4"/><span className="hidden lg:inline whitespace-nowrap">Ripoti tatizo</span>
            </a>
          </nav>
        </div>
      </header>

      {showRules && <HowToPlay onClose={() => setShowRules(false)} />}
      {showLogin && <SignUpModal onClose={() => setShowLogin(false)} />}
    </>
  )
}
