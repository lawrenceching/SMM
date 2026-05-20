import { useState, useCallback } from "react"

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return defaultValue
    }
    try {
      const item = window.localStorage.getItem(key)
      return item !== null ? (JSON.parse(item) as T) : defaultValue
    } catch {
      return defaultValue
    }
  })

  const setValue = useCallback(
    (value: T) => {
      setStoredValue(value)
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(key, JSON.stringify(value))
        } catch {
          // quota exceeded or private browsing — silently ignore
        }
      }
    },
    [key],
  )

  return [storedValue, setValue]
}
