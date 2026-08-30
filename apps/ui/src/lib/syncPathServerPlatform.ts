import { Path } from "@smm/utils/path"
import type { HelloResponseBody } from "@smm/types"

/** Apply CLI platform from bootstrap hello so `Path.toPlatformPath` matches the server. */
export function syncPathServerPlatformFromHello(hello: HelloResponseBody): void {
  Path.setServerPlatform(hello.platform)
}
