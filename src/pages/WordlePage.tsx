import { ChevronLeft } from 'lucide-react'
import { getWordleConfig, WordLength, SUPPORTED_LENGTHS } from '../lib/wordleConfig'
import Wordle from '../components/Wordle'
import { navigate } from '../lib/router'

export default function WordlePage({ length }: { length: WordLength }) {
  const config = getWordleConfig(length)
  return (
    <div className="max-w-3xl mx-auto pt-3">
      <div className="px-4 flex items-center gap-2 mb-1">
        <button onClick={() => navigate('/games')} className="text-umber-400 flex items-center gap-1 text-sm">
          <ChevronLeft className="w-4 h-4"/> Michezo zaidi
        </button>
      </div>
      <div className="text-center mb-2 px-4">
        <h1 className="text-2xl font-black text-umber-700 leading-tight">{config.label}</h1>
        <p className="text-umber-400 text-xs">{config.sublabel} · Moja kwa siku</p>
      </div>
      {/* length in key forces a fresh game state when switching variants */}
      <Wordle key={length} config={config} />
    </div>
  )
}

export { SUPPORTED_LENGTHS }
