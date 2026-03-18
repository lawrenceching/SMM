export interface NavBarProps {
  title: string
  onBack?: () => void
  children?: React.ReactNode
}

export function NavBar({ title, onBack, children }: NavBarProps) {
  return (
    <div className="flex h-12 items-center gap-3 border-b border-border bg-background px-4 shadow-sm">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex shrink-0 cursor-pointer items-center justify-center rounded-md p-2 transition-colors hover:bg-accent"
          aria-label="Back"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            className="text-foreground"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      <h1
        className={`min-w-0 flex-1 truncate font-semibold text-foreground ${
          onBack ? "text-lg" : "text-xl"
        }`}
      >
        {title}
      </h1>

      {children && (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      )}
    </div>
  )
}
