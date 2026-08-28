import { useEffect, useRef, useState } from 'react'

const FLASH_MS = 600

/** True for a brief window right after `value` changes; false otherwise. */
export function useFlash<T>(value: T): boolean {
  const prev = useRef(value)
  const [flashing, setFlashing] = useState(false)

  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value
      setFlashing(true)
      const timer = setTimeout(() => setFlashing(false), FLASH_MS)
      return () => clearTimeout(timer)
    }
  }, [value])

  return flashing
}

/** 'up' or 'down' for a brief window right after `value` changes direction; null otherwise. */
export function useDirectionalFlash(value: number): 'up' | 'down' | null {
  const prev = useRef(value)
  const [direction, setDirection] = useState<'up' | 'down' | null>(null)

  useEffect(() => {
    if (value !== prev.current) {
      const next = value > prev.current ? 'up' : 'down'
      prev.current = value
      setDirection(next)
      const timer = setTimeout(() => setDirection(null), FLASH_MS)
      return () => clearTimeout(timer)
    }
  }, [value])

  return direction
}
