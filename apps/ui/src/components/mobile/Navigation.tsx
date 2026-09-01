import { FolderListItem, type FolderListItemProps } from "@/components/sidebar/FolderListItem"
import { useTranslation } from "@/lib/i18n"

export interface NavigationProps {
  folders: FolderListItemProps[]
  handleMediaFolderListItemClick: (path: string) => void
}

export function Navigation({
  folders,
  handleMediaFolderListItemClick,
}: NavigationProps) {
  const { t } = useTranslation(["components"])
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
        {folders.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {t("sidebar.emptyState")}
          </div>
        ) : (
          folders.map((folder) => (
            <div key={folder.path} className="border-b border-border">
              <FolderListItem
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

