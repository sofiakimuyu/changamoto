import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Clock } from 'lucide-react'
import { VOCAB_CATEGORIES } from '../data/vocab-categories'
import { generateWordSearch, getCellsBetween, seededShuffle } from '../lib/wordsearch'
import { getDayIndex } from '../lib/wordle'
import WinSheet from './WinSheet'

const ALL_WORDS = VOCAB_CATEGORIES.flatMap(c => c.words)

// Time-based scoring: the faster the puzzle is solved, the more points.
// Thresholds are upper bounds in seconds; the first one the time falls under wins.
const SCORE_TIERS: [maxSeconds: number, points: number][] = [
  [30, 150], [60, 120], [90, 100], [120, 80],
  [180, 60], [240, 40], [300, 30], [360, 20],
]
/** Points for solving the word search in `seconds`. 10 points for any finish. */
function pointsForTime(seconds: number): number {
  for (const [max, points] of SCORE_TIERS) if (seconds < max) return points
  return 10
}

/** Format elapsed seconds as m:ss. */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function WordSearch() {
  const dayIdx = getDayIndex()

  const WS_TARGET = 15
  // Draw a larger candidate pool than the target so placement reliably fills 15.
  const wsWords = useMemo(() => {
    const fit = ALL_WORDS.filter(w => w.swahili.length >= 3 && w.swahili.length <= 8 && /^[A-Za-z]+$/.test(w.swahili))
    return seededShuffle(fit, dayIdx + 42).slice(0, 26).map(w => w.swahili.toUpperCase())
  }, [dayIdx])

  const { grid: wsGrid, placements: wsPlaced } = useMemo(
    () => generateWordSearch(wsWords, dayIdx + 7, WS_TARGET), [wsWords, dayIdx])
  const wsWordList = useMemo(() => wsPlaced.map(p => p.word), [wsPlaced])

  const [wsFirst, setWsFirst] = useState<[number, number] | null>(null)
  const [wsFound, setWsFound] = useState<string[]>([])
  const [wsFoundCells, setWsFoundCells] = useState<[number, number][]>([])
  const [wsWrongCells, setWsWrongCells] = useState<[number, number][]>([])
  const [showWin, setShowWin] = useState(true)

  // Timer: starts on first tap, ticks each second, freezes when solved.
  const [started, setStarted] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef<number | null>(null)
  const solveTimeRef = useRef<number | null>(null)
  const allFound = wsFound.length === wsWordList.length

  useEffect(() => {
    if (!started || allFound) return
    const id = setInterval(() => {
      if (startRef.current !== null) {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
      }
    }, 250)
    return () => clearInterval(id)
  }, [started, allFound])

  // Freeze the final solve time the moment every word is found.
  if (allFound && solveTimeRef.current === null && startRef.current !== null) {
    solveTimeRef.current = Math.floor((Date.now() - startRef.current) / 1000)
  }
  const finalSeconds = solveTimeRef.current ?? elapsed
  const points = pointsForTime(finalSeconds)

  const wsTapCell = (r: number, c: number) => {
    if (allFound) return
    // Start the clock on the very first interaction.
    if (!started) { startRef.current = Date.now(); setStarted(true) }
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

  return (
    <div className="px-3 pb-10 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-black text-umber-700">Tafuta Maneno</h2>
          <p className="text-umber-400 text-sm">Tafuta-maneno ya kila siku</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="flex items-center gap-1 font-black text-umber-700 tabular-nums">
            <Clock className="w-4 h-4 text-umber-400"/>{formatTime(finalSeconds)}
          </span>
          <span className="text-sm font-bold text-umber-400">{wsFound.length}/{wsWordList.length} yamepatikana</span>
        </div>
      </div>

      {allFound ? (
        <div className="text-center py-10">
          <div className="text-6xl mb-4">🔤</div>
          <h3 className="text-2xl font-black text-umber-700 mb-2">Umepata maneno yote!</h3>
          <p className="text-umber-400 mb-2">Umeyapata maneno yote!</p>
          <p className="text-umber-600 font-bold mb-6">
            Muda: {formatTime(finalSeconds)} · Pointi: {points}
          </p>
          {showWin && (
            <WinSheet emoji="🔤" title="Umeshinda!"
              subtitle={`Maneno ${wsWordList.length}/${wsWordList.length} · ${formatTime(finalSeconds)} · Pointi ${points}`}
              shareText={`Changamoto · Tafuta Maneno · ${formatTime(finalSeconds)} · ${points} pointi`}
              onClose={() => setShowWin(false)} />
          )}
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
                      className={`w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center text-[11px] sm:text-xs font-black transition-all ${
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
