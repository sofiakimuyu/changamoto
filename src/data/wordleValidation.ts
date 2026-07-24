// Pure guess-validation logic for the Neno la Leo (Wordle) game.
// Kept dependency-free and side-effect-free so it can be unit-tested directly.

/** Minimum size for a loaded word list to be trusted. A shorter list is
 *  treated as a failed/truncated load and validation fails closed. */
export const MIN_WORD_COUNT = 500

/** Normalize a guess for comparison: NFC unicode, trimmed, lowercased. */
export function normalizeGuess(raw: string): string {
  return raw.normalize('NFC').trim().toLowerCase()
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
