import { useState } from "react"

type Page = "list" | "detail"

export default function AppNavigation() {
  const [currentPage, setCurrentPage] = useState<Page>("list")
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null)

  const handleItemClick = (id: number) => {
    setSelectedItemId(id)
    setCurrentPage("detail")
  }

  const handleBack = () => {
    setCurrentPage("list")
  }

  // 生成占位符列表数据
  const listItems = Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    title: `列表项 ${i + 1}`,
    subtitle: `这是列表项 ${i + 1} 的描述信息`,
  }))

  return (
    <>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
      `}</style>
      <div
        style={{
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          position: "relative",
          backgroundColor: "#ffffff",
        }}
      >
      {/* 列表页 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          transform: currentPage === "list" ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 300ms ease-out",
          backgroundColor: "#f5f5f5",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* 列表页标题栏 */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderBottom: "1px solid #e0e0e0",
            padding: "0 16px",
            height: "48px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            display: "flex",
            alignItems: "center",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "20px",
              fontWeight: "600",
              color: "#333333",
            }}
          >
            列表
          </h1>
        </div>

        {/* 列表内容 */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "0",
            scrollbarWidth: "none", // Firefox
            msOverflowStyle: "none", // IE/Edge
            WebkitOverflowScrolling: "touch", // iOS 惯性滚动
            overscrollBehavior: "contain", // 防止滚动链
          }}
          className="hide-scrollbar"
        >
          {listItems.map((item) => (
            <div
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              style={{
                backgroundColor: "transparent",
                padding: "12px 16px",
                marginBottom: "0",
                border: "none",
                borderBottom: "1px solid #e8e8e8",
                cursor: "pointer",
                transition: "background-color 0.2s",
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.backgroundColor = "#f0f0f0"
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.backgroundColor = "transparent"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent"
              }}
              onTouchStart={(e) => {
                e.currentTarget.style.backgroundColor = "#f0f0f0"
              }}
              onTouchEnd={(e) => {
                e.currentTarget.style.backgroundColor = "transparent"
              }}
            >
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: "500",
                  color: "#333333",
                  marginBottom: "2px",
                }}
              >
                {item.title}
              </div>
              <div
                style={{
                  fontSize: "14px",
                  color: "#666666",
                }}
              >
                {item.subtitle}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 内容页 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          transform: currentPage === "detail" ? "translateX(0)" : "translateX(100%)",
          transition: "transform 300ms ease-out",
          backgroundColor: "#ffffff",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* 内容页导航栏 */}
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
          <button
            onClick={handleBack}
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
          <h2
            style={{
              margin: 0,
              fontSize: "18px",
              fontWeight: "600",
              color: "#333333",
            }}
          >
            详情
          </h2>
        </div>

        {/* 内容区域 */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "16px",
          }}
        >
          <div
            style={{
              backgroundColor: "#f8f8f8",
              borderRadius: "8px",
              padding: "24px",
              minHeight: "200px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div
              style={{
                fontSize: "20px",
                fontWeight: "600",
                color: "#333333",
              }}
            >
              内容页 - 项目 {selectedItemId}
            </div>
            <div
              style={{
                fontSize: "14px",
                color: "#666666",
                lineHeight: "1.6",
              }}
            >
              这是内容页的占位符内容。点击返回按钮可以返回到列表页。
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: "12px",
                marginTop: "16px",
              }}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    height: "120px",
                    backgroundColor: "#e8e8e8",
                    borderRadius: "6px",
                    border: "1px solid #d0d0d0",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  )
}

