import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

let sharedStyleSheet: CSSStyleSheet | null = null
let instanceCounter = 0

function initStyleSheet(): CSSStyleSheet | null {
  if (!sharedStyleSheet && typeof document !== "undefined") {
    const style = document.createElement("style")
    document.head.appendChild(style)
    sharedStyleSheet = style.sheet
  }
  return sharedStyleSheet
}

export interface AnimatedDotsTextProps {
  text: string
  /** Milliseconds between each dot appearing. Default 500. */
  interval?: number
  /** Maximum number of animated dots. Default 3. */
  maxDots?: number
  /** When true, pauses the dot animation. */
  paused?: boolean
  className?: string
}

export function AnimatedDotsText({
  text,
  interval = 500,
  maxDots = 3,
  paused = false,
  className,
}: AnimatedDotsTextProps) {
  const uidRef = useRef<number | null>(null)
  if (uidRef.current === null) {
    uidRef.current = instanceCounter++
  }
  const uid = uidRef.current

  const totalDuration = interval * (maxDots + 1)

  useEffect(() => {
    const sheet = initStyleSheet()
    if (!sheet) return

    for (let i = 0; i < maxDots; i++) {
      const percent = ((i + 1) / (maxDots + 1)) * 100
      const animName = `adt-anim-${uid}-${i}`
      const keyframesRule = `
        @keyframes ${animName} {
          0%, ${Math.max(0, percent - 0.1)}% { opacity: 0; }
          ${percent}%, 100% { opacity: 1; }
        }
      `
      sheet.insertRule(keyframesRule.trim(), sheet.cssRules.length)
    }
  }, [maxDots, uid])

  return (
    <span
      className={cn("font-semibold tracking-wide", className)}
      role="status"
      aria-label={`${text}...`}
    >
      <span>{text}</span>
      <span className="inline-block" aria-hidden="true">
        {Array.from({ length: maxDots }, (_, i) => {
          const animName = `adt-anim-${uid}-${i}`
          return (
            <span
              key={i}
              className="inline-block opacity-0"
              style={{
                animation: `${animName} ${totalDuration}ms infinite`,
                animationPlayState: paused ? "paused" : "running",
              }}
            >
              .
            </span>
          )
        })}
      </span>
    </span>
  )
}
