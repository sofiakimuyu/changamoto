// Slim type definitions used by Changamoto. Mirrors the subset of the Hekima
// data model that the ported vocabulary/challenge content relies on.

export interface VocabWord {
  id: string
  swahili: string
  english: string
  pronunciation: string
  example?: string
  exampleTranslation?: string
  category?: string
  mastery?: number
}

export interface VocabCategory {
  id: string
  name: string
  englishName: string
  description: string
  imageUrl: string
  emoji: string
  level: 'beginner' | 'intermediate' | 'advanced'
  words: VocabWord[]
}
