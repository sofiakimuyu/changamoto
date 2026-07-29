import { useEffect, useState } from 'react'
import { useHashRoute } from './lib/router'
import Nav from './components/Nav'
import Home from './pages/Home'
import MoreGames from './pages/MoreGames'
import LeaderboardPage from './pages/LeaderboardPage'
import ProfilePage from './pages/ProfilePage'
import WordlePage from './pages/WordlePage'
import WordSearch from './components/WordSearch'
import PairMatch from './components/PairMatch'
import WelcomeScreen from './components/WelcomeScreen'
import HowToPlay from './components/HowToPlay'
import SignUpModal from './components/SignUpModal'
import { WordLength, SUPPORTED_LENGTHS } from './lib/wordleConfig'
import { initAnalytics, trackPageView } from './lib/analytics'

// Once dismissed, don't nag the player with the splash on their next visit.
const WELCOME_KEY = 'changamoto_welcomed_v1'

function renderRoute(route: string) {
  if (route === '/' || route === '') return <Home />
  if (route === '/games') return <MoreGames />
  if (route === '/leaderboard') return <LeaderboardPage />
  if (route === '/profile') return <ProfilePage />
  if (route === '/wordsearch') return <WordSearch />
  if (route === '/pairmatch') return <PairMatch />

  const m = route.match(/^\/wordle\/(\d)$/)
  if (m) {
    const len = Number(m[1]) as WordLength
    if (SUPPORTED_LENGTHS.includes(len)) return <WordlePage length={len} />
  }
  return <Home />
}

export default function App() {
  const [route] = useHashRoute()

  // Welcome flow: show the splash on first load, then optionally the how-to-play
  // screen before dropping the player onto the board.
  const [showWelcome, setShowWelcome] = useState(() => {
    try { return localStorage.getItem(WELCOME_KEY) !== '1' } catch { return true }
  })
  const [showRules, setShowRules] = useState(false)
  const [showLogin, setShowLogin] = useState(false)

  const dismissWelcome = () => {
    try { localStorage.setItem(WELCOME_KEY, '1') } catch { /* ignore */ }
    setShowWelcome(false)
  }

  // Open a session on first load, then log a page view on every route change.
  useEffect(() => { initAnalytics(route) }, [])
  useEffect(() => { trackPageView(route) }, [route])

  return (
    <div className="min-h-screen bg-sand-100">
      <Nav />
      <main className="pb-10">{renderRoute(route)}</main>

      {showWelcome && (
        <WelcomeScreen
          onPlay={() => { dismissWelcome(); setShowRules(true) }}
          onLogin={() => setShowLogin(true)}
        />
      )}
      {showRules && <HowToPlay onClose={() => setShowRules(false)} />}
      {showLogin && <SignUpModal onClose={() => setShowLogin(false)} />}
    </div>
  )
}
