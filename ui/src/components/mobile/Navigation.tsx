import { MediaFolderListItem, type MediaFolderListItemProps } from "@/components/sidebar/MediaFolderListItem"

export interface NavigationProps {
  filteredAndSortedFolders: MediaFolderListItemProps[]
  handleMediaFolderListItemClick: (path: string) => void
}

export function Navigation({
  filteredAndSortedFolders,
  handleMediaFolderListItemClick,
}: NavigationProps) {
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
        {filteredAndSortedFolders.length === 0 ? (
          <div
            style={{
              padding: "16px",
              textAlign: "center",
              color: "#666666",
              fontSize: "14px",
            }}
          >
            没有找到媒体文件夹
          </div>
        ) : (
          filteredAndSortedFolders.map((folder) => (
            <div
              key={folder.path}
              style={{
                borderBottom: "1px solid #e8e8e8",
              }}
            >
              <div
                style={{
                  padding: "12px 16px",
                }}
              >
                <MediaFolderListItem
                  {...folder}
                  onClick={() => handleMediaFolderListItemClick(folder.path)}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </>
  )
}

