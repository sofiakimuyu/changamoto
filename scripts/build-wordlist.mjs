// build-wordlist.mjs — Build the Swahili Wordle word lists from the LibreOffice
// Hunspell dictionary (sw_TZ). No dependencies; run with plain Node (>=18).
//
//   node scripts/build-wordlist.mjs [wordLength]
//
// Downloads sw_TZ.dic / sw_TZ.aff, unmunches the (tiny) affix rules, filters to
// words that are exactly `wordLength` characters, and writes:
//   data/guesses.json  — permissive set of valid guesses (dictionary ∪ answers)
//   data/answers.json  — guesses ∩ data/common-seed.txt (the curated answer set)
//
// Both files are committed so the game never fetches anything at runtime.
//
// Notes / limitations:
//  - Words are counted by raw character length. Digraphs (ch, sh, ny, ng') are
//    NOT single tiles, matching the game's a–z keyboard.
//  - Words containing an apostrophe (the "ng'" sound) are DROPPED — the keyboard
//    cannot type them, so they could never be valid guesses.
//  - Capitalized (proper-noun-looking) entries are dropped.
//  - Affix support covers standard Hunspell PFX/SFX rules. The sw_TZ.aff only
//    defines a single prefix group, so this is more than enough here.

import { writeFile, readFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = resolve(ROOT, 'data')
const SEED_PATH = resolve(DATA_DIR, 'common-seed.txt')
const WORDLE_WORDS_TS = resolve(ROOT, 'src/data/wordle-words.ts')

const RAW = 'https://raw.githubusercontent.com/LibreOffice/dictionaries/master/sw_TZ'
const DIC_URL = `${RAW}/sw_TZ.dic`
const AFF_URL = `${RAW}/sw_TZ.aff`

const WORD_LENGTH = Number.parseInt(process.argv[2] ?? '5', 10)
if (!Number.isInteger(WORD_LENGTH) || WORD_LENGTH < 1) {
  console.error(`Invalid word length: ${process.argv[2]}`)
  process.exit(1)
}

// ── helpers ───────────────────────────────────────────────────────
const normalize = (s) => s.normalize('NFC').trim().toLowerCase()
const isPlainAlpha = (s) => /^[a-z]+$/.test(s) // drops apostrophes, hyphens, digits, accents
const isCapitalized = (s) => /^[A-Z]/.test(s)

// The .dic/.aff are declared ISO8859-1; decode as latin1 (Swahili is ~ASCII).
async function fetchLatin1(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${res.statusText}`)
  const buf = Buffer.from(await res.arrayBuffer())
  return buf.toString('latin1')
}

// ── Hunspell affix parsing / unmunching ───────────────────────────
// Parses PFX/SFX blocks:  "PFX flag cross_product count"  followed by
// `count` rules of the form  "PFX flag strip add [condition]".
function parseAff(affText) {
  const rules = new Map() // flag -> { type, entries: [{strip, add, cond}] }
  const lines = affText.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.startsWith('#') || (!line.startsWith('PFX ') && !line.startsWith('SFX '))) continue
    const parts = line.split(/\s+/)
    const type = parts[0] // PFX | SFX
    const flag = parts[1]
    // Header line: "PFX A Y 4" — 4 columns, 3rd is Y/N cross-product.
    if (parts.length === 4 && (parts[2] === 'Y' || parts[2] === 'N')) {
      rules.set(flag, { type, entries: [] })
      continue
    }
    // Rule line: "PFX A strip add cond"
    const rule = rules.get(flag)
    if (!rule) continue
    const strip = parts[2] === '0' ? '' : parts[2]
    const add = parts[3] === '0' ? '' : parts[3]
    const cond = parts[4] ?? '.'
    rule.entries.push({ strip, add, cond })
  }
  return rules
}

// Apply a single affix entry to a base word; returns the surface form or null.
function applyAffix(type, base, { strip, add, cond }) {
  if (type === 'PFX') {
    // condition matches the START of the word (default "." = anything)
    if (cond !== '.' && !new RegExp('^' + cond).test(base)) return null
    if (strip && !base.startsWith(strip)) return null
    return add + base.slice(strip.length)
  }
  // SFX: condition matches the END of the word
  if (cond !== '.' && !new RegExp(cond + '$').test(base)) return null
  if (strip && !base.endsWith(strip)) return null
  return base.slice(0, base.length - strip.length) + add
}

// Expand one dic entry (base + flags) into every surface form (base included).
function expand(base, flags, rules) {
  const forms = [base]
  for (const flag of flags) {
    const rule = rules.get(flag)
    if (!rule) continue
    for (const entry of rule.entries) {
      const form = applyAffix(rule.type, base, entry)
      if (form) forms.push(form)
    }
  }
  return forms
}

// ── read curated answer words out of wordle-words.ts ──────────────
async function readAnswerWords() {
  const src = await readFile(WORDLE_WORDS_TS, 'utf8')
  const words = new Set()
  for (const m of src.matchAll(/\bword:\s*"([^"]+)"/g)) {
    const w = normalize(m[1])
    if (isPlainAlpha(w) && w.length === WORD_LENGTH) words.add(w)
  }
  return words
}

// ── main ──────────────────────────────────────────────────────────
async function main() {
  console.log(`Building ${WORD_LENGTH}-letter Swahili word list…\n`)

  const [dicText, affText] = await Promise.all([fetchLatin1(DIC_URL), fetchLatin1(AFF_URL)])
  const rules = parseAff(affText)
  console.log(`Affix rules parsed: ${rules.size} group(s)`)

  const dicLines = dicText.split(/\r?\n/)
  // First line is the entry count; skip it. Blank trailing lines ignored.
  const declaredCount = Number.parseInt(dicLines[0], 10)
  const entries = dicLines.slice(1).filter((l) => l.trim() !== '')

  let expandedTotal = 0
  const dictWords = new Set()
  for (const raw of entries) {
    const slash = raw.indexOf('/')
    const base = (slash === -1 ? raw : raw.slice(0, slash)).trim()
    if (!base || isCapitalized(base)) continue // drop proper-noun-looking entries
    const flags = slash === -1 ? '' : raw.slice(slash + 1).trim()

    for (const form of expand(base, flags, rules)) {
      expandedTotal++
      const w = normalize(form)
      if (w.length === WORD_LENGTH && isPlainAlpha(w)) dictWords.add(w)
    }
  }

  const answerWords = await readAnswerWords()

  // guesses = dictionary ∪ curated answers (so every answer is always guessable)
  const guesses = new Set(dictWords)
  for (const w of answerWords) guesses.add(w)

  // common-seed.txt — curated answer pool. Generate it from wordle-words.ts on
  // first run so answers.json is a meaningful intersection rather than a copy.
  await mkdir(DATA_DIR, { recursive: true })
  let seed
  if (existsSync(SEED_PATH)) {
    const seedText = await readFile(SEED_PATH, 'utf8')
    seed = new Set(
      seedText.split(/\r?\n/).map(normalize).filter((w) => isPlainAlpha(w) && w.length === WORD_LENGTH),
    )
    console.log(`Loaded common-seed.txt (${seed.size} words)`)
  } else {
    seed = answerWords
    const header = '# Curated pool of Swahili answer words (one per line).\n' +
      '# Seeded from src/data/wordle-words.ts. Edit to curate the daily answers.\n'
    await writeFile(SEED_PATH, header + [...seed].sort().join('\n') + '\n', 'utf8')
    console.log(`No common-seed.txt found — generated one from wordle-words.ts (${seed.size} words)`)
  }

  // answers = guesses ∩ seed
  const answers = [...guesses].filter((w) => seed.has(w)).sort()
  const guessList = [...guesses].sort()

  await writeFile(resolve(DATA_DIR, 'guesses.json'), JSON.stringify(guessList) + '\n', 'utf8')
  await writeFile(resolve(DATA_DIR, 'answers.json'), JSON.stringify(answers, null, 0) + '\n', 'utf8')

  // ── stats ───────────────────────────────────────────────────────
  const sample = [...guessList].sort(() => Math.random() - 0.5).slice(0, 10)
  console.log('\n── Stats ─────────────────────────────')
  console.log(`Declared .dic count:        ${declaredCount}`)
  console.log(`Dic entries processed:      ${entries.length}`)
  console.log(`Surface forms after affix:  ${expandedTotal}`)
  console.log(`Dictionary ${WORD_LENGTH}-letter words:   ${dictWords.size}`)
  console.log(`Curated answer words:       ${answerWords.size}`)
  console.log(`guesses.json (dict∪answers):${guessList.length}`)
  console.log(`answers.json (guesses∩seed):${answers.length}`)
  console.log(`\n10 random samples (sanity check they are real words):`)
  console.log('  ' + sample.join(', '))

  if (guessList.length < 500) {
    console.error('\n⚠️  Fewer than 500 guesses — the game treats this as a failed load. Aborting.')
    process.exit(1)
  }
  console.log('\n✓ Wrote data/guesses.json and data/answers.json')
}

main().catch((err) => {
  console.error('\nBuild failed:', err.message)
  process.exit(1)
})
