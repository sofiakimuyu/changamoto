import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { VOCAB_CATEGORIES } from '../data/vocab-categories'
import { generateWordSearch, getCellsBetween, seededShuffle } from '../lib/wordsearch'
import { getDayIndex } from '../lib/wordle'

const ALL_WORDS = VOCAB_CATEGORIES.flatMap(c => c.words)

export default function WordSearch() {
  const dayIdx = getDayIndex()

  const wsWords = useMemo(() => {
    const shorts = ALL_WORDS.filter(w => w.swahili.length >= 4 && w.swahili.length <= 7 && /^[A-Za-z]+$/.test(w.swahili))
    return seededShuffle(shorts, dayIdx + 42).slice(0, 7).map(w => w.swahili.toUpperCase())
  }, [dayIdx])

  const { grid: wsGrid, placements: wsPlaced } = useMemo(() => generateWordSearch(wsWords, dayIdx + 7), [wsWords, dayIdx])
  const wsWordList = useMemo(() => wsPlaced.map(p => p.word), [wsPlaced])

  const [wsFirst, setWsFirst] = useState<[number, number] | null>(null)
  const [wsFound, setWsFound] = useState<string[]>([])
  const [wsFoundCells, setWsFoundCells] = useState<[number, number][]>([])
  const [wsWrongCells, setWsWrongCells] = useState<[number, number][]>([])

  const wsTapCell = (r: number, c: number) => {
    if (!wsFirst) { setWsFirst([r, c]); return }
    if (wsFirst[0] === r && wsFirst[1] === c) { setWsFirst(null); return }
    const cells = getCellsBetween(wsFirst, [r, c])
    if (!cells) { setWsFirst([r, c]); return }
    const word = cells.map(([rr, cc]) => wsGrid[rr][cc]).join('')
    const wordRev = [...word].reverse().join('')
    const match = wsWordList.find(w => w === word || w === wordRev)
    if (match && !wsFound.includes(match)) {
      setWsFound(f => [...f, match])
      setWsFoundCells(fc => [...fc, ...cells])
    } else {
      setWsWrongCells(cells)
      setTimeout(() => setWsWrongCells([]), 600)
    }
    setWsFirst(null)
  }

  const isCellFound = (r: number, c: number) => wsFoundCells.some(([rr, cc]) => rr === r && cc === c)
  const isCellWrong = (r: number, c: number) => wsWrongCells.some(([rr, cc]) => rr === r && cc === c)
  const isCellFirst = (r: number, c: number) => !!wsFirst && wsFirst[0] === r && wsFirst[1] === c
  const allFound = wsFound.length === wsWordList.length

  return (
    <div className="px-3 pb-10 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-black text-umber-700">Tafuta Maneno</h2>
          <p className="text-umber-400 text-sm">Daily word search</p>
        </div>
        <span className="font-black text-umber-700">{wsFound.length}/{wsWordList.length} found</span>
      </div>

      {allFound ? (
        <div className="text-center py-10">
          <div className="text-6xl mb-4">🔤</div>
          <h3 className="text-2xl font-black text-umber-700 mb-2">Umepata maneno yote!</h3>
          <p className="text-umber-400 mb-6">You found all the words!</p>
        </div>
      ) : (
        <>
          <div className="mb-5 select-none">
            {wsGrid.map((row, r) => (
              <div key={r} className="flex justify-center gap-0.5 mb-0.5">
                {row.map((letter, c) => {
                  const found = isCellFound(r, c)
                  const wrong = isCellWrong(r, c)
                  const first = isCellFirst(r, c)
                  return (
                    <button key={c} onClick={() => wsTapCell(r, c)}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black transition-all ${
                        found ? 'bg-savanna-400 text-white shadow-soft' :
                        wrong ? 'bg-maasai-400 text-white' :
                        first ? 'bg-ochre-400 text-white ring-2 ring-ochre-600' :
                                'bg-white text-umber-700 shadow-soft hover:bg-sand-100 active:scale-90'
                      }`}>
                      {letter}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 justify-center">
            {wsWordList.map(w => {
              const done = wsFound.includes(w)
              return (
                <span key={w}
                  className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all ${
                    done ? 'bg-savanna-100 text-savanna-700 line-through' : 'bg-white text-umber-600 shadow-soft'
                  }`}>
                  {done && <Check className="inline w-3.5 h-3.5 mr-1"/>}{w}
                </span>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
