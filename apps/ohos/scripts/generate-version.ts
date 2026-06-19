import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const cliPackageJsonPath = join(import.meta.dir, "..", "..", "cli", "package.json")
const packageJson = JSON.parse(readFileSync(cliPackageJsonPath, "utf-8")) as { version?: string }
const version = packageJson.version ?? "unknown"

const versionFileContent = `// This file is auto-generated at build time
// DO NOT EDIT MANUALLY
export const APP_VERSION = '${version}';
`

const versionFilePath = join(import.meta.dir, "..", "src", "version.ts")
writeFileSync(versionFilePath, versionFileContent, "utf-8")

console.log(`✓ Generated version.ts with version: ${version}`)
