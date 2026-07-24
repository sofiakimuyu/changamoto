import { useMemo } from 'react'

// A one-shot confetti burst for the win celebration. Pure CSS animation, so it
// costs nothing once the pieces have fallen. Rendered only while the win sheet
// is open.
const COLORS = ['#C8391A', '#2952CC', '#BF6E19', '#D4950A', '#3A7A3A', '#E04B28', '#F0C63F']

export default function Confetti({ count = 90 }: { count?: number }) {
  const pieces = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 2.4 + Math.random() * 1.6,
      color: COLORS[i % COLORS.length],
      size: 6 + Math.random() * 8,
      round: Math.random() > 0.7,
    })), [count])

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 60 }}>
      {pieces.map((p, i) => (
        <span key={i} className="confetti-piece"
          style={{
            left: `${p.left}vw`,
            width: p.size,
            height: p.round ? p.size : p.size * 1.4,
            background: p.color,
            borderRadius: p.round ? '50%' : '2px',
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }} />
      ))}
    </div>
  )
}
