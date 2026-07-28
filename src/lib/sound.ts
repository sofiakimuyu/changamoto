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

// Recorded clips are decoded into AudioBuffers and played through the same
// AudioContext as the synth cues. That context is resumed on the first
// keypress (playType), so — unlike an <audio> element, whose .play() gets
// blocked by autoplay policy when it fires from a setTimeout rather than
// directly in a gesture handler — buffer playback is reliably unlocked by the
// time a guess is submitted. Buffer sources also overlap natively, so a row of
// tiles flipping in quick succession doesn't cut itself off.
const buffers: Record<string, AudioBuffer | null> = {}
const loading: Record<string, boolean> = {}

function loadClip(c: AudioContext, url: string) {
  if (buffers[url] || loading[url]) return
  loading[url] = true
  fetch(url)
    .then(r => r.arrayBuffer())
    .then(ab => c.decodeAudioData(ab))
    .then(buf => { buffers[url] = buf })
    .catch(() => { loading[url] = false })
}

function makeClip(url: string, volume: number) {
  return () => {
    if (muted) return
    const c = getCtx(); if (!c) return
    const buf = buffers[url]
    if (!buf) { loadClip(c, url); return } // kick off load; plays on next call
    const src = c.createBufferSource(); src.buffer = buf
    const g = c.createGain(); g.gain.value = volume
    src.connect(g); g.connect(c.destination)
    src.start()
  }
}

const playFlipClip = makeClip(flipUrl, 0.7)
const playWinClip = makeClip(winUrl, 0.8)

// Warm the decode cache as soon as the audio context exists (first keypress),
// so the very first flip/win has its buffer ready rather than being skipped.
export function preloadClips() {
  const c = getCtx(); if (!c) return
  loadClip(c, flipUrl)
  loadClip(c, winUrl)
}

/** Soft, short key-click for typing a letter. Also warms the recorded-clip
 *  decode cache on the first gesture so the first flip/win isn't skipped. */
export function playType() {
  preloadClips()
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
