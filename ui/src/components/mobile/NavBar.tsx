export interface NavBarProps {
  title: string
  onBack?: () => void
  children?: React.ReactNode
}

export function NavBar({ title, onBack, children }: NavBarProps) {
  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        borderBottom: "1px solid #e0e0e0",
        padding: "0 16px",
        height: "48px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
      }}
    >
      {/* Back button - only shown when onBack is provided */}
      {onBack && (
        <button
          onClick={onBack}
          style={{
            backgroundColor: "transparent",
            border: "none",
            padding: "8px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "4px",
            transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#f0f0f0"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent"
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Title */}
      <h1
        style={{
          margin: 0,
          fontSize: onBack ? "18px" : "20px",
          fontWeight: "600",
          color: "#333333",
          flex: 1,
          minWidth: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {title}
      </h1>

      {/* Actions slot - rendered on the right */}
      {children && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

