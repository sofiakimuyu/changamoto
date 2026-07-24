// csv-to-answers.mjs — Convert the curated Swahili word CSVs into typed answer
// pools for the Changamoto Wordle. Each CSV shares the same columns:
//   word, english, part_of_speech, example_sw, example_en, notes
// Verb roots may be written with a leading '-' (e.g. "-kaa"); we strip it so the
// playable word is the bare stem. Output goes to src/data/answers-<len>.ts.

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = resolve(ROOT, 'src/data')

// Minimal RFC-4180 CSV parser (handles quoted fields with commas & escaped "").
function parseCsv(text) {
  const rows = []
  let row = [], field = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c === '\r') { /* skip */ }
    else field += c
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

const normalize = (s) => s.normalize('NFC').trim().toLowerCase()

async function convert(csvPath, len) {
  const text = await readFile(csvPath, 'utf8')
  const rows = parseCsv(text).filter(r => r.length >= 2 && r.some(c => c.trim() !== ''))
  rows.shift() // header

  const seen = new Set()
  const entries = []
  for (const [rawWord, english, pos, sentence, sentenceEn, notes] of rows) {
    const word = normalize((rawWord || '').replace(/^-+/, ''))
    if (!/^[a-z]+$/.test(word)) continue          // drop apostrophes/accents/digits
    if (word.length !== len) continue              // enforce exact length
    if (seen.has(word)) continue
    seen.add(word)
    entries.push({
      word,
      pos: (pos || '').trim(),
      english: (english || '').trim(),
      sentence: (sentence || '').trim(),
      sentenceEn: (sentenceEn || '').trim(),
      notes: (notes || '').trim(),
    })
  }

  const body = entries.map(e => '  ' + JSON.stringify(e)).join(',\n')
  const ts = `// Auto-generated from the curated ${len}-letter Swahili word CSV.
// These are the daily-answer pool for the ${len}-letter Changamoto Wordle.
import { WordleEntry } from './wordle-words'

export const ANSWERS_${len}: WordleEntry[] = [
${body}
]
`
  const out = resolve(OUT_DIR, `answers-${len}.ts`)
  await writeFile(out, ts)
  console.log(`answers-${len}.ts — ${entries.length} words`)
}

const UP = process.argv[2] // uploads dir
await convert(resolve(UP, '680f45c1-swahili_3letter_words.csv'), 3)
await convert(resolve(UP, '9405b64d-swahili_4letter_nouns.csv'), 4)
await convert(resolve(UP, '23fad831-swahili_6letter_words.csv'), 6)
