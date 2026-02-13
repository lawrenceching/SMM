/**
 * Helper function to extract parent directory from a file path
 * Handles Windows paths, UNC paths, home directory paths, and Unix paths
 */
export function getParentDirectory(path: string): string {
  if (!path || path.length === 0) {
    return "~"
  }

  // Handle Windows drive paths (e.g., C:\path\to\folder -> C:\path\to)
  const windowsDriveMatch = path.match(/^([A-Za-z]):(.*)$/)
  if (windowsDriveMatch) {
    const drive = windowsDriveMatch[1]
    const rest = windowsDriveMatch[2]
    
    // If at drive root (C:\ or C:\), return as-is
    if (!rest || rest === "\\" || rest === "/") {
      return `${drive}:\\`
    }
    
    // Remove trailing separator and get parent
    const normalized = rest.replace(/[/\\]+$/, "")
    const lastSeparator = Math.max(normalized.lastIndexOf("\\"), normalized.lastIndexOf("/"))
    
    if (lastSeparator <= 0) {
      // Only one level, return drive root
      return `${drive}:\\`
    }
    
    return `${drive}:${normalized.substring(0, lastSeparator)}`
  }

  // Handle UNC paths (e.g., \\server\share\folder -> \\server\share)
  if (path.startsWith("\\\\")) {
    const pathWithoutPrefix = path.substring(2)
    const parts = pathWithoutPrefix.split(/[/\\]/).filter(Boolean)
    
    // Need at least server\share, so minimum 2 parts
    if (parts.length <= 2) {
      return path // Already at root level
    }
    
    // Remove last part
    parts.pop()
    return "\\\\" + parts.join("\\")
  }

  // Handle home directory paths (e.g., ~/folder -> ~)
  if (path.startsWith("~")) {
    if (path === "~" || path === "~/") {
      return "~"
    }
    const rest = path.substring(1).replace(/^[/\\]+/, "")
    const lastSeparator = Math.max(rest.lastIndexOf("/"), rest.lastIndexOf("\\"))
    
    if (lastSeparator < 0) {
      return "~"
    }
    
    return "~/" + rest.substring(0, lastSeparator)
  }

  // Handle Unix paths (e.g., /path/to/folder -> /path/to)
  if (path.startsWith("/")) {
    if (path === "/") {
      return "/" // Root path
    }
    
    const normalized = path.replace(/\/+$/, "")
    const lastSeparator = normalized.lastIndexOf("/")
    
    if (lastSeparator === 0) {
      return "/" // Only one level, return root
    }
    
    return normalized.substring(0, lastSeparator)
  }

  // Fallback: try to find last separator
  const lastSeparator = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"))
  if (lastSeparator < 0) {
    return "~" // No separator found, return home
  }
  
  return path.substring(0, lastSeparator) || "~"
}
