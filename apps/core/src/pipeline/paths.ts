export function joinPosix(...parts: string[]): string {
  return parts.join("/");
}

export function basename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? "";
}

export function extname(path: string): string {
  const base = basename(path);
  const idx = base.lastIndexOf(".");
  return idx < 0 ? "" : base.slice(idx);
}
