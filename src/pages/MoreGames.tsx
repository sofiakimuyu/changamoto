import { ChevronRight } from 'lucide-react'
import { navigate } from '../lib/router'
import { getWordleStatus } from '../components/Wordle'

interface GameCard {
  route: string
  emoji: string
  title: string
  subtitle: string
  gradient: string
  len?: number
}

const GAMES: GameCard[] = [
  { route: '/wordle/3', emoji: '🔤', title: 'Neno la Herufi 3', subtitle: '3-letter Swahili Wordle', gradient: 'linear-gradient(135deg,#3A7A3A,#1C1209)', len: 3 },
  { route: '/wordle/4', emoji: '🔡', title: 'Neno la Herufi 4', subtitle: '4-letter Swahili Wordle', gradient: 'linear-gradient(135deg,#BF6E19,#1C1209)', len: 4 },
  { route: '/wordle/6', emoji: '🔠', title: 'Neno la Herufi 6', subtitle: '6-letter Swahili Wordle', gradient: 'linear-gradient(135deg,#2952CC,#091A57)', len: 6 },
  { route: '/wordsearch', emoji: '🔍', title: 'Tafuta Maneno', subtitle: 'Daily word search', gradient: 'linear-gradient(135deg,#C8391A,#7D220F)' },
  { route: '/pairmatch', emoji: '🧩', title: 'Oanisha Maneno', subtitle: 'Match Swahili to English', gradient: 'linear-gradient(135deg,#D4950A,#9B3D2A)' },
]

const STATUS_LABEL: Record<string, string> = {
  won: '✓ Solved today', lost: 'Come back tomorrow', playing: 'In progress…', none: '',
}

export default function MoreGames() {
  return (
    <div className="max-w-3xl mx-auto px-4 pt-6 pb-16">
      <h1 className="text-3xl font-black text-umber-700 mb-1">Michezo Zaidi</h1>
      <p className="text-umber-400 text-sm mb-6">More games · pick your challenge</p>

      <div className="space-y-3">
        {GAMES.map(g => {
          const status = g.len ? getWordleStatus(g.len) : 'none'
          return (
            <button key={g.route} onClick={() => navigate(g.route)}
              className="w-full relative rounded-3xl overflow-hidden shadow-card active:scale-98 transition-transform text-left">
              <div className="absolute inset-0" style={{ background: g.gradient }}/>
              <div className="absolute inset-0 lattice-pattern opacity-25"/>
              <div className="relative p-5 flex items-center gap-4">
                <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center text-2xl shrink-0">{g.emoji}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-black text-base">{g.title}</p>
                  <p className="text-white/65 text-sm">{g.subtitle}</p>
                  {status !== 'none' && <p className="text-white/80 text-xs mt-1">{STATUS_LABEL[status]}</p>}
                </div>
                <ChevronRight className="w-5 h-5 text-white/70 shrink-0"/>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
