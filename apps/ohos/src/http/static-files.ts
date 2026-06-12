import fs from "node:fs"
import path from "node:path"
import type { IncomingMessage, ServerResponse } from "node:http"
import { MIME_TYPES } from "../paths"

export function isPathWithinRoot(rootDir: string, absPath: string): boolean {
  return absPath === rootDir || absPath.startsWith(rootDir + path.sep)
}

export function getMimeType(filePath: string): string {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream"
}

export function resolveStaticPath(rootDir: string, urlPath: string): string | null {
  let pathname = urlPath
  try {
    pathname = decodeURIComponent(urlPath)
  } catch {
    // keep raw pathname
  }

  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\//, "")
  const abs = path.resolve(rootDir, rel)
  if (!isPathWithinRoot(rootDir, abs)) {
    return null
  }
  return abs
}

export function serveStaticFile(
  req: IncomingMessage,
  res: ServerResponse,
  rootDir: string,
): void {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" })
    res.end("Method Not Allowed")
    return
  }

  const url = req.url?.split("?")[0] ?? "/"
  const absPath = resolveStaticPath(rootDir, url)
  if (!absPath) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" })
    res.end("Forbidden")
    return
  }

  fs.stat(absPath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
      res.end("Not Found")
      return
    }

    res.writeHead(200, { "Content-Type": getMimeType(absPath) })
    if (req.method === "HEAD") {
      res.end()
      return
    }

    fs.createReadStream(absPath).pipe(res)
  })
}
