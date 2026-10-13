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

async function readStreamText(stream: ReadableStream<Uint8Array> | null): Promise<string> {
  if (!stream) {
    return ''
  }
  return new Response(stream).text()
}

async function runDockerCapture(args: string[], label: string): Promise<string> {
  const proc = Bun.spawn(['docker', ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const exitCode = await proc.exited
  const stdout = await readStreamText(proc.stdout)
  if (exitCode === 0) {
    return stdout
  }
  const stderr = await readStreamText(proc.stderr)
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
  const proc = Bun.spawn(
    ['docker', 'exec', opts.container, 'test', '-e', opts.containerPath],
    {
      stdout: 'ignore',
      stderr: 'ignore',
    },
  )
  const exitCode = await proc.exited
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
