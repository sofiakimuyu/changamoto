import { useEffect, useState, useCallback } from 'react'

// Tiny hash-based router — robust on static hosts (GitHub Pages) with no server
// rewrites, and dependency-free. Routes look like "#/games", "#/wordle/4".
export function useHashRoute(): [string, (to: string) => void] {
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || '/')
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash.slice(1) || '/')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const navigate = useCallback((to: string) => {
    window.location.hash = to
    window.scrollTo(0, 0)
  }, [])
  return [route, navigate]
}

export function navigate(to: string): void {
  window.location.hash = to
  window.scrollTo(0, 0)
}
