import fs from "node:fs"
import path from "node:path"
import { getDistDir } from "../paths"

const allowedRootItemsByDistDir = new Map<string, Set<string>>()

export function getAllowedRootItems(distDir: string = getDistDir()): Set<string> {
  const cached = allowedRootItemsByDistDir.get(distDir)
  if (cached) {
    return cached
  }

  const allowedRootItems = new Set<string>()
  try {
    const entries = fs.readdirSync(distDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === "index.html") continue
      allowedRootItems.add(entry.name + (entry.isDirectory() ? "/" : ""))
    }
  } catch (err) {
    console.error("[electron-port] read DIST_DIR failed:", err)
  }

  allowedRootItemsByDistDir.set(distDir, allowedRootItems)
  return allowedRootItems
}

/** @internal Test helper */
export function resetAllowedRootItemsCache(): void {
  allowedRootItemsByDistDir.clear()
}

export function toFileUrl(absPath: string): string {
  let p = absPath.replace(/\\/g, "/")
  if (/^[A-Za-z]:\//.test(p)) p = "/" + p
  return "file://" + p
}

export function resolveRedirect(urlString: string, distDir: string = getDistDir()): string | null {
  if (!urlString.startsWith("file://")) return null

  let pathname: string
  try {
    pathname = new URL(urlString).pathname
  } catch {
    return null
  }

  if (!pathname.startsWith("/")) return null
  if (/^\/[A-Za-z]:/.test(pathname)) return null

  let rel: string
  try {
    rel = decodeURIComponent(pathname.slice(1))
  } catch {
    rel = pathname.slice(1)
  }
  if (!rel) return null

  if (rel.split("/").some((seg) => seg === ".." || seg === ".")) {
    const abs = path.resolve(distDir, rel)
    if (abs !== distDir && !abs.startsWith(distDir + path.sep)) return null
    return toFileUrl(abs)
  }

  const firstSeg = rel.split("/")[0] ?? ""
  const first = firstSeg + (rel.includes("/") ? "/" : "")
  if (!getAllowedRootItems(distDir).has(first)) return null

  return toFileUrl(path.join(distDir, rel))
}
