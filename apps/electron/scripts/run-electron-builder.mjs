import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..")

/** Drop Node and the POT server from extraResources. The plugin zip stays. */
export function stripBgutilPackaging(config) {
  return config.replace(/[ \t]*# bgutil-packaging:begin\r?\n[\s\S]*?[ \t]*# bgutil-packaging:end\r?\n/g, "")
}

export function targetOmitsBgutilServer(args, env = process.env, hostArch = process.arch) {
  if (args.includes("--arm64")) return true
  if (args.includes("--x64") || args.includes("--ia32")) return false
  if (env.ARCH === "arm64") return true
  if (env.ARCH === "x64") return false
  return hostArch === "arm64"
}

function isExecutedDirectly() {
  const entry = process.argv[1]
  if (!entry) return false
  return import.meta.url === pathToFileURL(entry).href
}

if (isExecutedDirectly()) {
  const args = process.argv.slice(2)
  let config = readFileSync(join(appRoot, "electron-builder.yml"), "utf8")
  if (targetOmitsBgutilServer(args)) {
    config = stripBgutilPackaging(config)
  }

  const dir = mkdtempSync(join(tmpdir(), "smm-electron-builder-"))
  const configPath = join(dir, "electron-builder.yml")
  try {
    writeFileSync(configPath, config)
    const result = spawnSync("electron-builder", ["--config", configPath, ...args], {
      cwd: appRoot,
      stdio: "inherit",
      shell: true,
    })
    process.exit(result.status ?? 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
