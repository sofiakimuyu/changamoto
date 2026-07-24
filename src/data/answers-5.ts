// The 5-letter daily-answer pool is the curated 500-word list that powers the
// classic home-page Wordle. Re-exported here so every length has a uniform
// ANSWERS_<len> module.
import { WORDLE_WORDS, WordleEntry } from './wordle-words'

export const ANSWERS_5: WordleEntry[] = WORDLE_WORDS
