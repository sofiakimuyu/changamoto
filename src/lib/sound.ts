// Sound engine. The key-click cue is synthesized from filtered noise (Web
// Audio), while the tile-flip and win cues play the real recorded clips that
// ship with the app (cardflipsound.mp3 / correctsoundeffect2.mp3).
//
// Browsers only allow audio after a user gesture; since every cue is triggered
// by typing/clicking, playback is unlocked on that same gesture.

// Vite resolves and fingerprints these into the build (and rewrites the URL to
// honour the `base` path), so they work both in dev and on GitHub Pages.
import flipUrl from '../../cardflipsound.mp3'
import winUrl from '../../correctsoundeffect2.mp3'

let ctx: AudioContext | null = null
let noiseBuffer: AudioBuffer | null = null
let muted = false

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    try { ctx = new AC() } catch { return null }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

// A single reusable buffer of white noise, the raw material for both cues.
function getNoise(c: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === c.sampleRate) return noiseBuffer
  const len = Math.floor(c.sampleRate * 0.3)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  noiseBuffer = buf
  return buf
}

export function setMuted(m: boolean) { muted = m }
export function isMuted() { return muted }

// Small round-robin pools of <audio> elements per clip so rapid, overlapping
// plays (e.g. a row of tiles flipping in quick succession) don't cut each
// other off the way a single shared element would.
function makePool(url: string, size: number, volume: number) {
  const els: HTMLAudioElement[] = []
  let i = 0
  let ready = false
  const ensure = () => {
    if (ready || typeof Audio === 'undefined') return
    for (let n = 0; n < size; n++) {
      const a = new Audio(url)
      a.volume = volume
      a.preload = 'auto'
      els.push(a)
    }
    ready = true
  }
  return () => {
    if (muted) return
    ensure()
    if (!els.length) return
    const a = els[i]
    i = (i + 1) % els.length
    try { a.currentTime = 0; a.play().catch(() => {}) } catch { /* ignore */ }
  }
}

// One flip clip per tile can fire in quick succession; the win clip plays once.
const playFlipClip = makePool(flipUrl, 6, 0.7)
const playWinClip = makePool(winUrl, 2, 0.8)

/** Soft, short key-click for typing a letter. */
export function playType() {
  if (muted) return
  const c = getCtx(); if (!c) return
  const t = c.currentTime
  const src = c.createBufferSource(); src.buffer = getNoise(c)
  src.playbackRate.value = 0.9 + Math.random() * 0.2
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1600
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2500; bp.Q.value = 0.8
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.14, t + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045)
  src.connect(hp); hp.connect(bp); bp.connect(g); g.connect(c.destination)
  src.start(t); src.stop(t + 0.06)
}

/** Card-flip sound for a tile flipping over. Plays the recorded flip clip;
 *  called once per tile as a guess row reveals. */
export function playFlip() {
  playFlipClip()
}

/** Win cue — the recorded "correct" sound — played when a game is solved
 *  (Wordle, Word Search, Pair Match, …). */
export function playWin() {
  playWinClip()
}
