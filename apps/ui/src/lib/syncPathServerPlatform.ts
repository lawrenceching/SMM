import { Path } from "@core/path"
import type { HelloResponseBody } from "@core/types"

/** Apply CLI platform from bootstrap hello so `Path.toPlatformPath` matches the server. */
export function syncPathServerPlatformFromHello(hello: HelloResponseBody): void {
  Path.setServerPlatform(hello.platform)
}
