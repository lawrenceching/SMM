import { afterEach, describe, expect, it, vi } from 'vitest'
import { containerTmpRoot, resolveDockerContainerName } from './remoteDocker'

describe('remoteDocker', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('resolveDockerContainerName defaults to smm', () => {
    vi.stubEnv('SMM_DOCKER_CONTAINER', '')
    expect(resolveDockerContainerName()).toBe('smm')
  })

  it('resolveDockerContainerName reads env', () => {
    vi.stubEnv('SMM_DOCKER_CONTAINER', 'my-smm')
    expect(resolveDockerContainerName()).toBe('my-smm')
  })

  it('containerTmpRoot nests under /tmp', () => {
    expect(containerTmpRoot('run-1')).toBe('/tmp/run-1')
  })
})
