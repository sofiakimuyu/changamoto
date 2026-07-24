// Length-parameterized Wordle configuration. Each supported word length gets its
// own guess-validator (built from the generated dictionary list ∪ the curated
// answer pool) and daily-answer selector, so the same game engine drives the
// classic 5-letter home game and the 3/4/6-letter variants on the More Games page.
import { WordleEntry } from '../data/wordle-words'
import { createGuessValidator, normalizeGuess } from '../data/wordleValidation'

import guesses3 from '../data/wordlists/guesses-3.json'
import guesses4 from '../data/wordlists/guesses-4.json'
import guesses5 from '../data/wordlists/guesses-5.json'
import guesses6 from '../data/wordlists/guesses-6.json'
import { ANSWERS_3 } from '../data/answers-3'
import { ANSWERS_4 } from '../data/answers-4'
import { ANSWERS_5 } from '../data/answers-5'
import { ANSWERS_6 } from '../data/answers-6'

export type WordLength = 3 | 4 | 5 | 6

const RAW: Record<WordLength, { guesses: string[]; answers: WordleEntry[] }> = {
  3: { guesses: guesses3 as string[], answers: ANSWERS_3 },
  4: { guesses: guesses4 as string[], answers: ANSWERS_4 },
  5: { guesses: guesses5 as string[], answers: ANSWERS_5 },
  6: { guesses: guesses6 as string[], answers: ANSWERS_6 },
}

export interface WordleConfig {
  length: WordLength
  label: string          // Swahili title
  sublabel: string       // English subtitle
  /** True only when the guess list loaded and is large enough to trust. */
  loaded: boolean
  /** Validate a raw guess (normalizes internally). Fails closed on a bad load. */
  isValidGuess(raw: string): boolean
  /** The curated answer pool (words with definitions). */
  answers: WordleEntry[]
}

const LABELS: Record<WordLength, { label: string; sublabel: string }> = {
  3: { label: 'Neno la Herufi 3', sublabel: 'Guess the 3-letter Swahili word' },
  4: { label: 'Neno la Herufi 4', sublabel: 'Guess the 4-letter Swahili word' },
  5: { label: 'Neno la Leo',      sublabel: 'Guess the 5-letter Swahili word' },
  6: { label: 'Neno la Herufi 6', sublabel: 'Guess the 6-letter Swahili word' },
}

function buildConfig(length: WordLength): WordleConfig {
  const { guesses, answers } = RAW[length]
  // The answer pool must always be guessable, so union it into the valid set.
  const answerWords = answers.map(a => normalizeGuess(a.word))
  const validator = createGuessValidator([...guesses, ...answerWords])
  return {
    length,
    ...LABELS[length],
    loaded: validator.loaded,
    isValidGuess: (raw: string) => validator.isValid(raw),
    answers,
  }
}

const CONFIGS: Record<WordLength, WordleConfig> = {
  3: buildConfig(3),
  4: buildConfig(4),
  5: buildConfig(5),
  6: buildConfig(6),
}

export function getWordleConfig(length: WordLength): WordleConfig {
  return CONFIGS[length]
}

export const SUPPORTED_LENGTHS: WordLength[] = [3, 4, 5, 6]
