export function isHarmonyOS(): boolean {
  if (typeof navigator === "undefined") {
    return false
  }
  const appVersion = navigator.appVersion
  return appVersion.includes("OHOS") || appVersion.includes("OpenHarmony")
}
