'use client'

import { useEffect, useState } from 'react'

/**
 * Resolves when Norse faces are usable so UI can avoid a fallback→Norse swap flash.
 */
export function useNorseFontsReady() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts?.load) {
      setReady(true)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        await document.fonts.load('700 48px Norse')
        await document.fonts.load('400 48px Norse')
      } catch {
        /* still show UI */
      }
      if (!cancelled) setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return ready
}
