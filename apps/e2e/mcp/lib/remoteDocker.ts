import { spawn } from 'node:child_process'
import path from 'node:path'

export function resolveDockerContainerName(): string {
  const name = process.env.SMM_DOCKER_CONTAINER
  if (!name) {
    return 'smm'
  }
  return name
}

export function newRemoteRunId(): string {
  const random = crypto.randomUUID()
  return `smm-mcp-${Date.now()}-${random}`
}

export function containerTmpRoot(runId: string): string {
  return `/tmp/${runId}`
}

type DockerRunResult = {
  exitCode: number
  stdout: string
  stderr: string
}

function runDockerProcess(
  args: string[],
  io: 'capture' | 'silent',
): Promise<DockerRunResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn('docker', args, {
      stdio:
        io === 'capture'
          ? ['ignore', 'pipe', 'pipe']
          : ['ignore', 'ignore', 'ignore'],
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''
    if (io === 'capture') {
      proc.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString()
      })
      proc.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
      })
    }

    proc.on('error', reject)
    proc.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
      })
    })
  })
}

async function runDockerCapture(args: string[], label: string): Promise<string> {
  const { exitCode, stdout, stderr } = await runDockerProcess(args, 'capture')
  if (exitCode === 0) {
    return stdout
  }
  const combined = [stderr, stdout].filter(Boolean).join('\n').trim()
  throw new Error(
    combined ? `${label}: ${combined}` : `${label}: docker exited with code ${exitCode}`,
  )
}

async function runDocker(args: string[], label: string): Promise<void> {
  await runDockerCapture(args, label)
}

export async function dockerCpDirToContainer(opts: {
  container: string
  hostDir: string
  containerDir: string
}): Promise<void> {
  const parent = path.posix.dirname(opts.containerDir)
  await runDocker(['exec', opts.container, 'mkdir', '-p', parent], 'docker exec mkdir -p')
  await runDocker(
    ['cp', `${opts.hostDir}/.`, `${opts.container}:${opts.containerDir}/`],
    'docker cp',
  )
}

export async function dockerRmContainerPath(opts: {
  container: string
  containerPath: string
}): Promise<void> {
  await runDocker(
    ['exec', opts.container, 'rm', '-rf', opts.containerPath],
    'docker exec rm',
  )
}

export async function dockerPathExists(opts: {
  container: string
  containerPath: string
}): Promise<boolean> {
  const { exitCode } = await runDockerProcess(
    ['exec', opts.container, 'test', '-e', opts.containerPath],
    'silent',
  )
  return exitCode === 0
}

export async function dockerReadTextFile(opts: {
  container: string
  containerPath: string
}): Promise<string> {
  return runDockerCapture(
    ['exec', opts.container, 'cat', opts.containerPath],
    'docker exec cat',
  )
}
