import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { $ } from 'bun'
import { Path } from '@smm/core'
import type { MediaMetadata } from '@smm/core/types'
import type { TestFolder } from '@smm/test'
import { createFolderInTestFolder } from '../test/actions/import-folders'
import { runCliHello } from '../test/lib/cli-hello'

const helpersDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(helpersDir, '../../..')
const MEDIA_METADATA_TEMPLATES_DIR = join(repoRoot, 'test', 'templates', 'mediaMetadatas')

/** Require a non-empty env var (loaded from `apps/e2e/.env.local` via testbed-core). */
export function requiredEnv(name: string): string {
    const value = process.env[name]?.trim()
    if (!value) {
        throw new Error(`${name} is not set (apps/e2e/.env.local)`)
    }
    return value
}

/** Shape of an awaited `$` subprocess result (bun-types does not export ShellOutput). */
interface CliSubprocessResult {
    stdout: Buffer
    stderr: Buffer
    exitCode: number
}

/** Combine stdout and stderr from a CLI subprocess result. */
export function cliOutput(result: CliSubprocessResult): string {
    const stdout = result.stdout.toString()
    const stderr = result.stderr.toString()
    if (!stdout) return stderr
    if (!stderr) return stdout
    return `${stdout}\n${stderr}`
}

export function parsePlanId(stdout: string): string {
    const planId = stdout.match(/plan:\s+([0-9a-f-]{36})/i)?.[1]
    if (!planId) {
        throw new Error(`plan id not found in: ${stdout}`)
    }
    return planId
}

async function resolveCoreDataDir(binary: string): Promise<string> {
    const { userDataDir } = await runCliHello(binary)
    return userDataDir
}

export async function planFilePath(binary: string, planId: string): Promise<string> {
    const dataDir = await resolveCoreDataDir(binary)
    const filename = `${planId}.plan.json`
    return join(dataDir, 'plans', filename)
}

/** CLI `metadata` output line for a linked media file (platform path separators). */
export function metadataMediaFileLine(
    folderPath: string,
    fileName: string,
    seasonNumber: number,
    episodeNumber: number,
): string {
    return `absolutePath: ${Path.toPlatformPath(join(folderPath, fileName))}  seasonNumber: ${seasonNumber}  episodeNumber: ${episodeNumber}`
}

export function renamedFolderPath(folderPath: string, folderName: string): string {
    return join(dirname(folderPath), `${folderName} - Renamed`)
}

function loadTemplate(templateFileName: string): MediaMetadata {
    const templatePath = join(MEDIA_METADATA_TEMPLATES_DIR, templateFileName)
    return JSON.parse(readFileSync(templatePath, 'utf-8')) as MediaMetadata
}

function rewritePathsForFolder(mediaMetadata: MediaMetadata, folderPath: string): MediaMetadata {
    const folderPosix = Path.posix(folderPath)
    return {
        ...mediaMetadata,
        mediaFolderPath: folderPosix,
        mediaFiles: mediaMetadata.mediaFiles?.map((file) => ({
            ...file,
            absolutePath: Path.posix(join(folderPath, file.absolutePath)),
        })),
    }
}

export type CreateAndImportInitializedFolderOptions = {
    mediaMetadata?: MediaMetadata
    templateFileName?: string
    updateMediaMetadata?: (mediaMetadata: MediaMetadata) => MediaMetadata
}

/** Create fixture on disk, `add --skip-init`, seed metadata via `smm metadata --set`. */
export async function createAndImportInitializedFolder(
    binary: string,
    folder: TestFolder,
    options: CreateAndImportInitializedFolderOptions = {},
): Promise<TestFolder> {
    const created = createFolderInTestFolder(folder)
    const folderPath = created.path!

    const added = await $`${binary} add ${folderPath} --type ${created.type} --skip-init`.nothrow()
    if (added.exitCode !== 0) {
        throw new Error(added.text())
    }

    let mediaMetadata: MediaMetadata
    if (options.mediaMetadata) {
        mediaMetadata = {
            ...options.mediaMetadata,
            mediaFolderPath: Path.posix(folderPath),
        }
    } else {
        const templateFileName = options.templateFileName ?? '天使降临到我身边.metadata.json'
        mediaMetadata = rewritePathsForFolder(loadTemplate(templateFileName), folderPath)
    }

    if (options.updateMediaMetadata) {
        mediaMetadata = options.updateMediaMetadata(mediaMetadata)
    }
    mediaMetadata.mediaFolderPath = Path.posix(folderPath)

    await seedMetadataViaCli(binary, folderPath, mediaMetadata)

    return created
}

async function seedMetadataViaCli(
    binary: string,
    folderPath: string,
    mediaMetadata: MediaMetadata,
): Promise<void> {
    const tmpDir = mkdtempSync(join(tmpdir(), 'smm-meta-seed-'))
    const jsonFile = join(tmpDir, 'metadata.json')
    try {
        writeFileSync(
            jsonFile,
            JSON.stringify(
                {
                    type: mediaMetadata.type,
                    mediaFiles: mediaMetadata.mediaFiles,
                    tvShow: mediaMetadata.tvShow,
                    movie: mediaMetadata.movie,
                },
                null,
                2,
            ),
            'utf-8',
        )
        const setResult = await $`${binary} metadata ${folderPath} --set ${jsonFile}`.nothrow()
        if (setResult.exitCode !== 0) {
            throw new Error(setResult.text())
        }
    } finally {
        rmSync(tmpDir, { recursive: true, force: true })
    }
}

export async function recognizeAndApply(binary: string, path: string): Promise<void> {
    const recognized = await $`${binary} try-to-recognize ${path}`.nothrow()
    if (recognized.exitCode !== 0) {
        throw new Error(recognized.text())
    }
    const planId = parsePlanId(recognized.text())
    const applied = await $`${binary} apply ${planId}`.nothrow()
    if (applied.exitCode !== 0) {
        throw new Error(applied.text())
    }
}

/** TMDB template name contains ":" which is invalid on Windows paths. */
export function withWindowsSafeTvShowName(mm: MediaMetadata): MediaMetadata {
    return {
        ...mm,
        tvShow: mm.tvShow
            ? { ...mm.tvShow, name: 'WATATEN an Angel Flew Down to Me' }
            : mm.tvShow,
    }
}
