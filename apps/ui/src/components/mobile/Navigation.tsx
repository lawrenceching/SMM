import { MediaFolderListItemV2, type MediaFolderListItemV2Props } from "@/components/sidebar/MediaFolderListItemV2"

export interface NavigationProps {
  filteredAndSortedFolders: MediaFolderListItemV2Props[]
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
          <div className="p-4 text-center text-sm text-muted-foreground">
            没有找到媒体文件夹
          </div>
        ) : (
          filteredAndSortedFolders.map((folder) => (
            <div key={folder.path} className="border-b border-border">
              <MediaFolderListItemV2
                  mediaName={folder.mediaName}
                  mediaType={folder.mediaType}
                  path={folder.path}
                  onClick={() => handleMediaFolderListItemClick(folder.path)}
                />
            </div>
          ))
        )}
      </div>
    </>
  )
}

