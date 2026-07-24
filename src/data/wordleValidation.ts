// Pure guess-validation logic for the Neno la Leo (Wordle) game.
// Kept dependency-free and side-effect-free so it can be unit-tested directly.

/** Minimum size for a loaded word list to be trusted. A shorter list is
 *  treated as a failed/truncated load and validation fails closed. */
export const MIN_WORD_COUNT = 500

/** Normalize a guess for comparison: NFC unicode, trimmed, lowercased. */
export function normalizeGuess(raw: string): string {
  return raw.normalize('NFC').trim().toLowerCase()
}

/**
 * Lenient Swahili phonotactic check. Swahili orthography is highly regular, so a
 * few structural rules accept essentially every real Swahili word — including
 * inflected/derived forms a static dictionary can't fully enumerate — while
 * rejecting strings that can't be Swahili. Used as an OR alongside the bundled
 * dictionary so guessing accepts any real Swahili word, not only listed ones.
 * Because it only ever ADDS acceptance on top of the dictionary, being lenient
 * here can never reject a word the dictionary already knows.
 */
export function isPlausibleSwahili(raw: string): boolean {
  const w = normalizeGuess(raw)
  if (!/^[a-z]+$/.test(w)) return false
  if (w.length < 2) return false
  if (/[qx]/.test(w)) return false          // q and x aren't used in Swahili
  if (/c(?!h)/.test(w)) return false         // c only occurs in the digraph 'ch'
  if (!/[aeiou]/.test(w)) return false       // a word must contain a vowel
  if (/(.)\1\1/.test(w)) return false        // no letter repeated 3× in a row
  if (/[^aeiou]{4,}/.test(w)) return false    // no run of 4+ consonants
  if (!/[aeioumn]$/.test(w)) return false     // ends in a vowel or a nasal (m/n)
  return true
}

export interface GuessValidator {
  /** True only if the word list loaded and is large enough to trust. */
  readonly loaded: boolean
  /** Number of unique words in the loaded set. */
  readonly size: number
  /** Membership test. Returns false for every guess when not `loaded`. */
  isValid(raw: string): boolean
}

/**
 * Build a validator from a word list. Fails CLOSED: if the list is missing,
 * empty, or smaller than {@link MIN_WORD_COUNT}, `loaded` is false and
 * `isValid` rejects every guess.
 */
export function createGuessValidator(words: readonly string[] | null | undefined): GuessValidator {
  const set = new Set<string>()
  if (Array.isArray(words)) {
    for (const w of words) {
      if (typeof w !== 'string') continue
      const n = normalizeGuess(w)
      if (n) set.add(n)
    }
  }
  const loaded = set.size >= MIN_WORD_COUNT
  return {
    loaded,
    size: set.size,
    isValid(raw: string): boolean {
      if (!loaded) return false
      return set.has(normalizeGuess(raw))
    },
  }
}
