// Word-search grid generation and selection helpers (ported from Hekima).
export const WS_SIZE = 9
const WS_LETTERS = 'ABCDEFGHIKLMNOPRSTUVWZ'
// 4 directions: right, down, diagonal-right, diagonal-left.
const WS_DIRS: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]]

export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]; let s = seed
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function seededRandFactory(seed: number) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return Math.abs(s) / 0x7fffffff }
}

export interface WordSearch {
  grid: string[][]
  placements: { word: string; cells: [number, number][] }[]
}

export function generateWordSearch(words: string[], seed: number): WordSearch {
  const rand = seededRandFactory(seed)
  const grid: string[][] = Array.from({ length: WS_SIZE }, () => Array(WS_SIZE).fill(''))
  const placements: { word: string; cells: [number, number][] }[] = []

  for (const raw of words) {
    const word = raw.toUpperCase()
    let done = false
    for (let attempt = 0; attempt < 120 && !done; attempt++) {
      const [dr, dc] = WS_DIRS[Math.floor(rand() * WS_DIRS.length)]
      const row = Math.floor(rand() * WS_SIZE)
      const col = Math.floor(rand() * WS_SIZE)
      const cells: [number, number][] = []
      let valid = true
      for (let i = 0; i < word.length; i++) {
        const r = row + i * dr, c = col + i * dc
        if (r < 0 || r >= WS_SIZE || c < 0 || c >= WS_SIZE) { valid = false; break }
        if (grid[r][c] !== '' && grid[r][c] !== word[i]) { valid = false; break }
        cells.push([r, c])
      }
      if (valid) {
        cells.forEach(([r, c], i) => { grid[r][c] = word[i] })
        placements.push({ word, cells })
        done = true
      }
    }
  }

  // Fill blanks with random letters.
  for (let r = 0; r < WS_SIZE; r++) {
    for (let c = 0; c < WS_SIZE; c++) {
      if (grid[r][c] === '') grid[r][c] = WS_LETTERS[Math.floor(rand() * WS_LETTERS.length)]
    }
  }
  return { grid, placements }
}

export function getCellsBetween(a: [number, number], b: [number, number]): [number, number][] | null {
  const dr = b[0] - a[0], dc = b[1] - a[1]
  const len = Math.max(Math.abs(dr), Math.abs(dc))
  if (len === 0) return [[a[0], a[1]]]
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null // not a straight line
  const sr = dr === 0 ? 0 : dr / Math.abs(dr)
  const sc = dc === 0 ? 0 : dc / Math.abs(dc)
  const cells: [number, number][] = []
  for (let i = 0; i <= len; i++) cells.push([a[0] + i * sr, a[1] + i * sc])
  return cells
}
