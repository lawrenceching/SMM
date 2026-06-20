import { useEffect, useRef, type DependencyList } from "react"

/**
 * Runs `effect` once each time `isOpen` transitions to true.
 * Resets when `isOpen` becomes false so a subsequent open can run again.
 */
export function useOnFirstOpen(
  effect: () => void,
  isOpen: boolean,
  deps: DependencyList,
): void {
  const hasRunRef = useRef(false)

  useEffect(() => {
    if (!isOpen) {
      hasRunRef.current = false
      return
    }
    if (hasRunRef.current) {
      return
    }
    hasRunRef.current = true
    effect()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are the caller's open-scoped inputs
  }, [isOpen, ...deps])
}
