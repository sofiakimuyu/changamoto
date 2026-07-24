import { useHashRoute } from './lib/router'
import Nav from './components/Nav'
import Home from './pages/Home'
import MoreGames from './pages/MoreGames'
import LeaderboardPage from './pages/LeaderboardPage'
import WordlePage from './pages/WordlePage'
import WordSearch from './components/WordSearch'
import PairMatch from './components/PairMatch'
import { WordLength, SUPPORTED_LENGTHS } from './lib/wordleConfig'

function renderRoute(route: string) {
  if (route === '/' || route === '') return <Home />
  if (route === '/games') return <MoreGames />
  if (route === '/leaderboard') return <LeaderboardPage />
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
  return (
    <div className="min-h-screen bg-sand-100">
      <Nav />
      <main className="pb-10">{renderRoute(route)}</main>
    </div>
  )
}
