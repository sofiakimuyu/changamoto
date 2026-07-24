// Shared Wordle game logic: deterministic daily-word selection and guess scoring.
// Kept UI-free so it can be reused across every word length and unit-tested.
import { WordleEntry } from '../data/wordle-words'
import { WordLength } from './wordleConfig'

export type LetterState = 'correct' | 'present' | 'absent'
export const MAX_ROWS = 6

/** Whole-day epoch index — the same for every player in a given UTC day. */
export function getDayIndex(): number {
  return Math.floor(Date.now() / 86400000)
}

// Fixed deterministic shuffle so every player gets the same word each day and no
// word repeats until the whole pool is exhausted.
function fixedShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]; let s = seed
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// A distinct shuffle seed per length so the four games don't march in lockstep.
const SEEDS: Record<WordLength, number> = { 3: 30260709, 4: 40260709, 5: 20260709, 6: 60260709 }
const ORDER_CACHE = new Map<WordLength, number[]>()

export function answerForDay(length: WordLength, pool: WordleEntry[], dayIdx: number): WordleEntry {
  let order = ORDER_CACHE.get(length)
  if (!order) {
    order = fixedShuffle(pool.map((_, i) => i), SEEDS[length])
    ORDER_CACHE.set(length, order)
  }
  const n = order.length
  const idx = ((dayIdx % n) + n) % n
  return pool[order[idx]]
}

// Two-pass scoring that correctly handles duplicate letters.
export function scoreGuess(guess: string, answer: string): LetterState[] {
  const len = answer.length
  const res: LetterState[] = Array(len).fill('absent')
  const ans = answer.split('')
  const used = Array(len).fill(false)
  for (let i = 0; i < len; i++) {
    if (guess[i] === ans[i]) { res[i] = 'correct'; used[i] = true }
  }
  for (let i = 0; i < len; i++) {
    if (res[i] === 'correct') continue
    for (let j = 0; j < len; j++) {
      if (!used[j] && guess[i] === ans[j]) { res[i] = 'present'; used[j] = true; break }
    }
  }
  return res
}
