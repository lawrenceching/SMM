export function isElectron(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as Window & { electron?: unknown }).electron !== "undefined"
  )
}
