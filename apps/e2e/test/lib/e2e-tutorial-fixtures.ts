/**
 * Shared helpers for manual Transcribe e2e specs (`test/media/tutorials/`).
 *
 * Docker: fixtures are synced into the container at `/media/tutorials` before
 * `docker run` (see `ci/e2e-docker-container.ts`). Binary copies use `docker exec cp`
 * because `POST /api/writeFile` is text-only.
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, cpSync, existsSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { browser } from '@wdio/globals'
import type { TestFolder } from 'test/actions/import-folders'
import {
    createTestFolderViaBrowser,
    joinPlatformPath,
    listFileNamesViaBrowser,
    resolveSmmTestFolderViaBrowser,
} from 'test/lib/browser-fs'
import { isDockerE2e } from 'test/lib/e2e-platform'

export const E2E_TUTORIAL_HOST_DIR = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../media/tutorials',
)

/** Path inside the smm e2e container (bind-mounted from host `tmpdir/smm/tutorials`). */
export const E2E_TUTORIAL_DOCKER_DIR = '/media/tutorials'

const DOCKER_CONTAINER_NAME = 'smm'

export function tutorialFixturesAvailableOnHost(): boolean {
    if (!existsSync(E2E_TUTORIAL_HOST_DIR)) {
        return false
    }
    try {
        return (
            statSync(E2E_TUTORIAL_HOST_DIR).isDirectory() &&
            existsSync(path.join(E2E_TUTORIAL_HOST_DIR, 'p1.mp4'))
        )
    } catch {
        return false
    }
}

export function tutorialFixturesAvailableInDockerContainer(): boolean {
    const result = spawnSync(
        'docker',
        ['exec', DOCKER_CONTAINER_NAME, 'test', '-f', `${E2E_TUTORIAL_DOCKER_DIR}/p1.mp4`],
        { encoding: 'utf-8', shell: false },
    )
    return result.status === 0
}

export function assertTutorialFixturesForCurrentPlatform(): void {
    if (isDockerE2e) {
        if (!tutorialFixturesAvailableOnHost()) {
            throw new Error(
                `[e2e] Missing ${E2E_TUTORIAL_HOST_DIR} (p1.mp4). ` +
                    'Create it locally; e2e-docker-container syncs it into the container at /media/tutorials.',
            )
        }
        if (!tutorialFixturesAvailableInDockerContainer()) {
            throw new Error(
                `[e2e] Tutorial fixtures not found in container at ${E2E_TUTORIAL_DOCKER_DIR}/p1.mp4. ` +
                    'Restart the smm e2e container so ci/e2e-docker-container can sync tutorials.',
            )
        }
        return
    }

    if (!tutorialFixturesAvailableOnHost()) {
        throw new Error(
            `[e2e] Missing ${E2E_TUTORIAL_HOST_DIR}. ` +
                'Add sample videos (e.g. p1.mp4, p2.mp4) before running Transcribe specs.',
        )
    }
}

function runDockerExecCp(sourceInContainer: string, destInContainer: string): void {
    const result = spawnSync(
        'docker',
        ['exec', DOCKER_CONTAINER_NAME, 'cp', sourceInContainer, destInContainer],
        { encoding: 'utf-8', shell: false },
    )
    if (result.status !== 0) {
        const detail = (result.stderr || result.stdout || '').trim()
        throw new Error(
            `docker exec cp failed (${sourceInContainer} -> ${destInContainer}): ${detail || `exit ${result.status}`}`,
        )
    }
}

function runDockerExecShell(command: string): void {
    const result = spawnSync('docker', ['exec', DOCKER_CONTAINER_NAME, 'bash', '-lc', command], {
        encoding: 'utf-8',
        shell: false,
    })
    if (result.status !== 0) {
        const detail = (result.stderr || result.stdout || '').trim()
        throw new Error(`docker exec bash failed: ${detail || `exit ${result.status}`}`)
    }
}

/** Copy one fixture mp4 from `/media/tutorials` to a container path under tmpDir. */
export function copyTutorialFileInDockerContainer(
    sourceFileName: string,
    destContainerPath: string,
): void {
    const src = `${E2E_TUTORIAL_DOCKER_DIR}/${sourceFileName}`
    runDockerExecCp(src, destContainerPath)
}

/** Copy host tutorial mp4 into a test folder (desktop / Electron). */
export function copyTutorialFileOnHost(
    sourceFileName: string,
    destHostPath: string,
): void {
    copyFileSync(path.join(E2E_TUTORIAL_HOST_DIR, sourceFileName), destHostPath)
}

export async function waitForFolderFileNames(
    folderPath: string,
    fileNames: string[],
    timeoutMs = 4 * 60 * 1000,
): Promise<void> {
    await browser.waitUntil(
        async () => {
            const names = await listFileNamesViaBrowser(folderPath)
            return fileNames.every((name) => names.includes(name))
        },
        {
            timeout: timeoutMs,
            interval: 2000,
            timeoutMsg: `Timed out waiting for ${fileNames.join(', ')} in ${folderPath}`,
        },
    )
}

/**
 * Clone `test/media/tutorials` into a unique music folder and import via UI event.
 */
export async function copyTutorialsAndImportMusicFolder(traceId: string): Promise<TestFolder> {
    const folderName = `Tutorials-${Date.now()}`
    const root = await resolveSmmTestFolderViaBrowser()
    const folderPath = joinPlatformPath(root, folderName)

    if (isDockerE2e) {
        runDockerExecShell(`mkdir -p "${folderPath}" && cp -r "${E2E_TUTORIAL_DOCKER_DIR}/." "${folderPath}/"`)
    } else {
        mkdirSync(folderPath, { recursive: true })
        cpSync(E2E_TUTORIAL_HOST_DIR, folderPath, { recursive: true })
    }

    const files = await listFileNamesViaBrowser(folderPath)
    const folder: TestFolder = {
        folderName,
        files,
        type: 'music',
        path: folderPath,
    }

    const { importMediaFolder } = await import('test/actions/events')
    await importMediaFolder({
        type: 'music',
        folderPathInPlatformFormat: folderPath,
        traceId,
    })

    return folder
}
