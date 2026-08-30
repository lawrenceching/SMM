import type { HelloCliBody } from '@smm/types'

export function formatHelloLines(body: HelloCliBody): string[] {
  return [
    `Version: ${body.version}`,
    `Platform: ${body.platform}`,
    `Uptime: ${body.uptime}s`,
    `User data dir: ${body.userDataDir}`,
    `App data dir: ${body.appDataDir}`,
    `Tmp dir: ${body.tmpDir}`,
    `Log dir: ${body.logDir}`,
    `OS locale: ${body.osLocale}`,
  ]
}
