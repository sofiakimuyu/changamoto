import { getWordleConfig } from '../lib/wordleConfig'
import Wordle from '../components/Wordle'
import { getDayIndex } from '../lib/wordle'

export default function Home() {
  const config = getWordleConfig(5)
  const dayNumber = getDayIndex() - 20657 // human-friendly "day #" since launch

  return (
    <div className="max-w-3xl mx-auto pt-4">
      <div className="text-center mb-2 px-4">
        <h1 className="text-2xl font-black text-umber-700 leading-tight">Neno la Leo</h1>
        <p className="text-umber-400 text-xs">Word of the day · #{dayNumber > 0 ? dayNumber : 1}</p>
      </div>
      <Wordle config={config} ranked />
    </div>
  )
}
