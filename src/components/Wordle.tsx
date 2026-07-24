import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Delete, Share2, Check, Trophy } from 'lucide-react'
import { WordleConfig } from '../lib/wordleConfig'
import { answerForDay, scoreGuess, getDayIndex, MAX_ROWS, LetterState } from '../lib/wordle'
import { recordDaily, submitDaily } from '../lib/leaderboard'
import { navigate } from '../lib/router'
import { playType, playFlip } from '../lib/sound'

interface SavedGame {
  day: number
  guesses: string[]
  status: 'playing' | 'won' | 'lost'
}

function storageKey(len: number) { return `changamoto_wordle_v1_${len}` }

function loadGame(len: number, day: number): SavedGame | null {
  try {
    const raw = localStorage.getItem(storageKey(len))
    if (!raw) return null
    const g = JSON.parse(raw) as SavedGame
    return g.day === day ? g : null
  } catch { return null }
}
function saveGame(len: number, g: SavedGame) {
  try { localStorage.setItem(storageKey(len), JSON.stringify(g)) } catch { /* ignore */ }
}

/** Today's status for a length, for menu cards. */
export function getWordleStatus(len: number): 'won' | 'lost' | 'playing' | 'none' {
  const g = loadGame(len, getDayIndex())
  return g ? g.status : 'none'
}

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']

const TILE_COLOR: Record<LetterState, string> = {
  correct: 'bg-savanna-500 border-savanna-500 text-white',
  present: 'bg-saffron-400 border-saffron-400 text-white',
  absent:  'bg-umber-300 border-umber-300 text-white',
}
const KEY_COLOR: Record<LetterState, string> = {
  correct: 'bg-savanna-500 text-white',
  present: 'bg-saffron-400 text-white',
  absent:  'bg-umber-200 text-umber-500',
}

interface Props { config: WordleConfig; ranked?: boolean }

export default function Wordle({ config, ranked = false }: Props) {
  const WORD_LEN = config.length
  const day = getDayIndex()
  const answer = useMemo(() => answerForDay(config.length, config.answers, day), [config, day])

  const initial = useMemo(() => loadGame(WORD_LEN, day), [WORD_LEN, day])
  const [guesses, setGuesses] = useState<string[]>(initial?.guesses ?? [])
  const [status, setStatus]   = useState<'playing' | 'won' | 'lost'>(initial?.status ?? 'playing')
  const [current, setCurrent] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [shaking, setShaking] = useState(false)
  const [revealRow, setRevealRow] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(status !== 'playing')

  const currentRef = useRef(current)

  // Record the outcome to the leaderboard once, for the ranked (daily) game.
  useEffect(() => {
    if (ranked && status !== 'playing') {
      recordDaily(day, status === 'won', guesses.length)
      // Publish to the shared leaderboard (no-op when no backend is configured).
      submitDaily(day)
    }
  }, [ranked, status, day, guesses.length])

  const toast = useCallback((msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(null), 1400)
  }, [])

  const submit = useCallback(() => {
    if (status !== 'playing') return
    const cur = currentRef.current
    if (cur.length < WORD_LEN) { toast('Not enough letters'); setShaking(true); return }
    if (!config.loaded) { toast('Word list failed to load'); setShaking(true); return }
    if (!config.isValidGuess(cur)) { toast('Not in word list'); setShaking(true); return }

    const newGuesses = [...guesses, cur]
    const won  = cur === answer.word
    const lost = !won && newGuesses.length >= MAX_ROWS
    const newStatus: 'playing' | 'won' | 'lost' = won ? 'won' : lost ? 'lost' : 'playing'

    currentRef.current = ''
    setCurrent('')
    setGuesses(newGuesses)
    setRevealRow(newGuesses.length - 1)
    setStatus(newStatus)
    // Paper rustle for each tile, timed to its flip (matches the c*0.12s stagger).
    for (let c = 0; c < WORD_LEN; c++) setTimeout(playFlip, c * 120)
    saveGame(WORD_LEN, { day, guesses: newGuesses, status: newStatus })

    if (newStatus !== 'playing') setTimeout(() => setShowResult(true), 1600)
  }, [status, guesses, answer.word, day, config, WORD_LEN, toast])

  const addLetter = useCallback((l: string) => {
    if (status !== 'playing') return
    if (currentRef.current.length >= WORD_LEN) return
    currentRef.current += l
    setCurrent(currentRef.current)
    playType()
  }, [status, WORD_LEN])

  const removeLetter = useCallback(() => {
    if (status !== 'playing') return
    currentRef.current = currentRef.current.slice(0, -1)
    setCurrent(currentRef.current)
  }, [status])

  const onKey = useCallback((key: string) => {
    if (key === 'Enter') submit()
    else if (key === 'Backspace') removeLetter()
    else if (/^[a-z]$/.test(key)) addLetter(key)
  }, [submit, removeLetter, addLetter])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (k === 'Enter' || k === 'Backspace' || /^[a-z]$/.test(k)) { e.preventDefault(); onKey(k) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onKey])

  useEffect(() => { if (shaking) { const t = setTimeout(() => setShaking(false), 500); return () => clearTimeout(t) } }, [shaking])

  const keyStates = useMemo(() => {
    const rank: Record<LetterState, number> = { absent: 0, present: 1, correct: 2 }
    const m: Record<string, LetterState> = {}
    guesses.forEach(g => {
      const sc = scoreGuess(g, answer.word)
      for (let i = 0; i < WORD_LEN; i++) {
        const l = g[i], s = sc[i]
        if (!m[l] || rank[s] > rank[m[l]]) m[l] = s
      }
    })
    return m
  }, [guesses, answer.word, WORD_LEN])

  const rows = useMemo(() => {
    const out: { letters: string[]; states: (LetterState | null)[]; isCurrent: boolean }[] = []
    for (let r = 0; r < MAX_ROWS; r++) {
      if (r < guesses.length) {
        const g = guesses[r]
        out.push({ letters: g.split(''), states: scoreGuess(g, answer.word), isCurrent: false })
      } else if (r === guesses.length && status === 'playing') {
        const letters = current.padEnd(WORD_LEN).split('')
        out.push({ letters, states: Array(WORD_LEN).fill(null), isCurrent: true })
      } else {
        out.push({ letters: Array(WORD_LEN).fill(''), states: Array(WORD_LEN).fill(null), isCurrent: false })
      }
    }
    return out
  }, [guesses, current, status, answer.word, WORD_LEN])

  // Tile size shrinks as the word gets longer so the grid always fits.
  const tile = WORD_LEN >= 6 ? 'w-12 h-12 text-xl' : 'w-14 h-14 text-2xl'

  const shareResult = () => {
    const grid = guesses.map(g =>
      scoreGuess(g, answer.word).map(s => s === 'correct' ? '🟩' : s === 'present' ? '🟨' : '⬛').join('')
    ).join('\n')
    const header = `Changamoto ${WORD_LEN}·${config.label} · ${status === 'won' ? guesses.length : 'X'}/${MAX_ROWS}`
    const text = `${header}\n${grid}\nchangamoto`
    if (navigator.clipboard) { navigator.clipboard.writeText(text).then(() => toast('Copied to clipboard')) }
    else toast('Copy not supported')
  }

  return (
    <div className="flex flex-col items-center px-4 pb-10">
      {/* Word-list load failure — validation fails closed, so surface it. */}
      {!config.loaded && (
        <div className="mx-auto mb-2 max-w-md rounded-xl bg-red-100 border border-red-300 text-red-700 text-sm font-semibold px-4 py-2 text-center">
          Word list failed to load. Guessing is disabled — please reload the app.
        </div>
      )}

      {/* Toast */}
      <div className="h-7 flex items-center justify-center">
        {message && (
          <div className="bg-umber-700 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-card animate-fade-in">
            {message}
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="flex flex-col items-center gap-1.5 my-4" style={{ perspective: '800px' }}>
        {rows.map((row, r) => (
          <div key={r} className={`flex gap-1.5 ${row.isCurrent && shaking ? 'animate-shake' : ''}`}>
            {row.letters.map((letter, c) => {
              const st = row.states[c]
              const filled = letter.trim() !== ''
              const base = `${tile} rounded-xl flex items-center justify-center font-black uppercase transition-colors`
              let cls = 'border-2 border-sand-300 bg-white text-umber-700'
              if (st) cls = `border-2 ${TILE_COLOR[st]}`
              else if (filled) cls = 'border-2 border-umber-300 bg-white text-umber-700 animate-pop'
              const revealing = st && r === revealRow
              return (
                <div key={c} className={`${base} ${cls} ${revealing ? 'animate-flip-in' : ''}`}
                  style={revealing ? { animationDelay: `${c * 0.12}s` } : undefined}>
                  {letter.trim()}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Keyboard */}
      <div className="w-full max-w-md space-y-1.5 select-none">
        {KEY_ROWS.map((rowStr, i) => (
          <div key={i} className="flex justify-center gap-1.5">
            {i === 2 && (
              <button onClick={() => onKey('Enter')}
                className="h-12 px-2.5 rounded-lg bg-umber-200 text-umber-600 text-[11px] font-bold flex items-center justify-center active:scale-95">
                ENTER
              </button>
            )}
            {rowStr.split('').map(l => {
              const s = keyStates[l]
              const cls = s ? KEY_COLOR[s] : 'bg-white text-umber-700'
              return (
                <button key={l} onClick={() => onKey(l)}
                  className={`h-12 flex-1 max-w-[2.4rem] rounded-lg font-bold uppercase text-sm shadow-soft active:scale-95 transition-colors ${cls}`}>
                  {l}
                </button>
              )
            })}
            {i === 2 && (
              <button onClick={() => onKey('Backspace')}
                className="h-12 px-2.5 rounded-lg bg-umber-200 text-umber-600 flex items-center justify-center active:scale-95">
                <Delete className="w-5 h-5"/>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Result sheet */}
      {showResult && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-umber-700/40 animate-fade-in"
          onClick={() => setShowResult(false)}>
          <div className="w-full max-w-md bg-sand-100 rounded-t-3xl p-5 pb-8 shadow-card animate-slide-up max-h-[88vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-sand-300 rounded-full mx-auto mb-4"/>

            <div className="text-center mb-4">
              <div className="text-5xl mb-2">{status === 'won' ? '🎉' : '🌱'}</div>
              <h3 className="text-2xl font-black text-umber-700">
                {status === 'won' ? 'Umeshinda!' : 'Karibu tena kesho'}
              </h3>
              <p className="text-umber-400 text-sm">
                {status === 'won' ? `Solved in ${guesses.length}/${MAX_ROWS}` : 'You’ll get the next one!'}
              </p>
            </div>

            {/* Answer / definition card */}
            <div className="relative rounded-3xl p-5 mb-4 shadow-card overflow-hidden"
              style={{ background: 'linear-gradient(135deg,#3A7A3A,#1C1209)' }}>
              <div className="absolute inset-0 lattice-pattern opacity-20"/>
              <div className="relative">
                <p className="text-white/60 text-[11px] font-semibold uppercase tracking-widest mb-1">Today’s word</p>
                <h4 className="text-4xl font-black text-white uppercase tracking-wide">{answer.word}</h4>
                {answer.pos && <p className="text-white/70 text-sm mt-1 italic">{answer.pos}</p>}
                <p className="text-white text-lg font-bold mt-2">{answer.english}</p>
              </div>
            </div>

            {answer.sentence && (
              <div className="bg-white rounded-2xl p-4 mb-3 shadow-soft">
                <p className="text-[11px] font-bold text-umber-400 uppercase tracking-widest mb-1.5">Sample sentence</p>
                <p className="text-umber-700 font-semibold">{answer.sentence}</p>
                {answer.sentenceEn && <p className="text-umber-400 text-sm mt-0.5 italic">{answer.sentenceEn}</p>}
              </div>
            )}

            {answer.notes && (
              <div className="bg-white rounded-2xl p-4 mb-4 shadow-soft">
                <p className="text-[11px] font-bold text-umber-400 uppercase tracking-widest mb-1.5">Usage notes</p>
                <p className="text-umber-600 text-sm leading-relaxed">{answer.notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2.5">
              {ranked && (
                <button onClick={() => navigate('/leaderboard')}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-full font-bold btn-primary">
                  <Trophy className="w-5 h-5"/> View leaderboard
                </button>
              )}
              <div className="flex gap-2.5">
                <button onClick={shareResult}
                  className="flex-1 flex items-center justify-center gap-2 bg-white border-2 border-sand-200 text-umber-600 font-semibold py-4 rounded-full">
                  <Share2 className="w-4 h-4"/> Share
                </button>
                <button onClick={() => setShowResult(false)}
                  className="flex-1 flex items-center justify-center gap-2 bg-umber-700 text-white font-semibold py-4 rounded-full">
                  Done <Check className="w-4 h-4"/>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
