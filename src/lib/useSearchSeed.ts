import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Global search hubs jump to pages as `/page?q=term`. Pages consume the query
 * once into their local search box and strip it from the URL, so the box
 * stays user-editable afterwards.
 */
export function useSearchSeed(setSearch: (q: string) => void) {
  const [params, setParams] = useSearchParams()
  useEffect(() => {
    const q = params.get('q')
    if (q) {
      setSearch(q)
      const next = new URLSearchParams(params)
      next.delete('q')
      setParams(next, { replace: true })
    }
  }, [params, setSearch, setParams])
}
