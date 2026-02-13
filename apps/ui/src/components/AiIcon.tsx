import { cn } from "@/lib/utils"
import { Bot } from "lucide-react"

export interface AiIconProps {
  /** Size of the icon */
  size?: number
  /** Additional className */
  className?: string
}

/**
 * A beautiful holographic AI icon component with animated rainbow rings,
 * energy pulses, and a glowing center. Perfect for indicating AI activity.
 *
 * @example
 * ```tsx
 * <AiIcon size={80} />
 * ```
 */
export function AiIcon({ size = 80, className }: AiIconProps) {
  return (
    <div
      className={cn("relative flex items-center justify-center shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {/* Rainbow pulsing rings */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: "conic-gradient(from 0deg, #8b5cf6, #ec4899, #3b82f6, #10b981, #8b5cf6)",
          backgroundSize: "200% 200%",
          animation: "ai-rainbow-rotate 3s linear infinite",
          mask: "radial-gradient(circle at center, transparent 40%, black 70%)",
          WebkitMask: "radial-gradient(circle at center, transparent 40%, black 70%)",
        }}
      />

      {/* Outer energy ring */}
      <div
        className="absolute inset-0 rounded-full border-2 border-transparent"
        style={{
          background: "linear-gradient(45deg, rgba(139, 92, 246, 0.3), rgba(236, 72, 153, 0.3), rgba(59, 130, 246, 0.3)) border-box",
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "subtract",
          WebkitMaskComposite: "xor",
          animation: "ai-energy-pulse 2s ease-in-out infinite",
        }}
      />

      {/* Middle holographic ring */}
      <div
        className="absolute inset-2 rounded-full"
        style={{
          background: `
            linear-gradient(135deg,
              rgba(139, 92, 246, 0.8) 0%,
              rgba(236, 72, 153, 0.8) 25%,
              rgba(59, 130, 246, 0.8) 50%,
              rgba(16, 185, 129, 0.8) 75%,
              rgba(139, 92, 246, 0.8) 100%
            )
          `,
          animation: "ai-holographic-shift 4s ease-in-out infinite",
        }}
      />

      {/* Inner core with Bot icon */}
      <div
        className="relative z-10 flex items-center justify-center w-14 h-14 rounded-full bg-linear-to-br from-white/95 via-white/90 to-white/80 backdrop-blur-sm"
        style={{
          boxShadow: `
            inset 0 1px 0 rgba(255, 255, 255, 0.4),
            0 0 30px rgba(139, 92, 246, 0.4),
            0 0 60px rgba(236, 72, 153, 0.2)
          `,
          animation: "ai-core-glow 2s ease-in-out infinite alternate",
        }}
      >
        <Bot className="w-7 h-7 text-violet-600 drop-shadow-sm" />
      </div>

      {/* Holographic overlay */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: `
            linear-gradient(135deg,
              rgba(255, 255, 255, 0.3) 0%,
              transparent 30%,
              transparent 70%,
              rgba(255, 255, 255, 0.2) 100%
            )
          `,
          animation: "ai-holographic-scan 3s linear infinite",
        }}
      />
    </div>
  )
}

