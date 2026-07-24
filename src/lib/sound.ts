// Tiny Web Audio sound engine — no audio files, so nothing extra to host or
// fetch. Two cues: a soft key-click when a letter is typed, and a short
// paper-rustle when a tile flips. Sounds are synthesized from filtered noise.
//
// Browsers only allow audio after a user gesture; since both cues are triggered
// by typing/clicking, the context resumes on that same gesture.

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

/** Short paper-rustle for a tile flipping over. Slightly randomized each call
 *  so a row of flips sounds like riffled paper rather than a repeated tone. */
export function playFlip() {
  if (muted) return
  const c = getCtx(); if (!c) return
  const t = c.currentTime
  const src = c.createBufferSource(); src.buffer = getNoise(c)
  src.playbackRate.value = 0.85 + Math.random() * 0.4
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'
  bp.frequency.value = 1500 + Math.random() * 1300; bp.Q.value = 0.6
  const g = c.createGain()
  const dur = 0.12 + Math.random() * 0.05
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.13, t + 0.006)
  // Two-stage decay gives a soft "crinkle" tail rather than a clean beep.
  g.gain.exponentialRampToValueAtTime(0.04, t + dur * 0.5)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(hp); hp.connect(bp); bp.connect(g); g.connect(c.destination)
  src.start(t); src.stop(t + dur + 0.02)
}

/** Triumphant little fanfare when the word is solved. Ascending arpeggio with
 *  a soft bell timbre, plus a sparkle tail. */
export function playWin() {
  if (muted) return
  const c = getCtx(); if (!c) return
  const t0 = c.currentTime
  // C5, E5, G5, C6 — a bright major arpeggio.
  const notes = [523.25, 659.25, 783.99, 1046.5]
  notes.forEach((freq, i) => {
    const t = t0 + i * 0.1
    const osc = c.createOscillator(); osc.type = 'triangle'; osc.frequency.value = freq
    const osc2 = c.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = freq * 2
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45)
    const g2 = c.createGain(); g2.gain.value = 0.25
    osc.connect(g); osc2.connect(g2); g2.connect(g); g.connect(c.destination)
    osc.start(t); osc.stop(t + 0.5)
    osc2.start(t); osc2.stop(t + 0.5)
  })
  // Sparkle: a few quick high blips after the arpeggio lands.
  for (let i = 0; i < 5; i++) {
    const t = t0 + 0.42 + i * 0.05
    const osc = c.createOscillator(); osc.type = 'sine'
    osc.frequency.value = 1400 + Math.random() * 1600
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.1, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
    osc.connect(g); g.connect(c.destination)
    osc.start(t); osc.stop(t + 0.14)
  }
}
