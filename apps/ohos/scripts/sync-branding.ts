import { copyFileSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const ohosDir = join(import.meta.dir, "..")
const electronDir = join(ohosDir, "..", "electron")
const iconSrc = join(electronDir, "resources", "icon.png")

const builderYml = readFileSync(join(electronDir, "electron-builder.yml"), "utf-8")
const productNameMatch = builderYml.match(/^productName:\s*(.+)$/m)
const productName = productNameMatch?.[1]?.trim() ?? "SMM"

const electronPkg = JSON.parse(readFileSync(join(electronDir, "package.json"), "utf-8")) as {
  version?: string
  description?: string
}

const appResDir = join(
  ohosDir,
  "web_engine",
  "src",
  "main",
  "resources",
  "resfile",
  "resources",
  "app",
)
const appScopeMedia = join(ohosDir, "AppScope", "resources", "base", "media")

for (const target of [
  join(appScopeMedia, "app_icon.png"),
  join(appScopeMedia, "startIcon.png"),
  join(appScopeMedia, "product_logo_32.png"),
  join(appResDir, "icon.png"),
]) {
  copyFileSync(iconSrc, target)
}

const packageJson = {
  name: productName,
  version: electronPkg.version ?? "1.0.0",
  description: electronPkg.description ?? `${productName} for HarmonyOS`,
  main: "main.js",
  scripts: {
    start: "electron .",
  },
}

writeFileSync(join(appResDir, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`)

console.log(`✓ Synced branding from apps/electron (productName: ${productName})`)
