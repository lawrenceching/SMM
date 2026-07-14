import { isEmpty } from "es-toolkit/compat"
import { fetchDiscoverConfig, type DiscoverConfig, type ReverseProxyEndpoint } from "./discover"
import { readUserConfig } from "./readUserConfig"
import { fetchByInternalReverseProxy } from "./fetchByInternalReverseProxy"
import { fetchWithFailover } from "@/lib/http"
import staticConfig from "./staticConfig"

export const SMM_TVDB_DEFAULT_UPSTREAM = staticConfig.externalTvdbApiServerBaseUrl

export async function fetchTvdb(urlPath: string, options?: {
    disabledDomains?: Set<string>
    config?: DiscoverConfig
    signal?: AbortSignal,
    defaultUrl?: string,
    defualtProxy?: ReverseProxyEndpoint,
    /**
     * TVDB JWT obtained from `POST /login`. Required when a custom TVDB
     * host (`userConfig.tvdb.host`) is configured; ignored for the SMM-
     * managed default upstream, which uses discovered general reverse
     * proxies that handle auth themselves.
     */
    jwt?: string
}) {

    const userConfig = await readUserConfig()
    const { host, httpProxy } = userConfig.tvdb ?? {}

    if (!isEmpty(host) && URL.canParse(host!)) {
        const jwt = options?.jwt?.trim()
        if (!jwt) {
            throw new Error(
                'TVDB JWT is required when using a custom TVDB host. ' +
                'Obtain one via TVDBv4.login() (see apps/ui/src/lib/TvdbUtils.ts).',
            )
        }
        const headers: Record<string, string> = {
            Authorization: `Bearer ${jwt}`,
        }

        return await fetchByInternalReverseProxy(
            host!,
            urlPath,
            {
                signal: options?.signal,
                headers,
                httpProxy: httpProxy?.trim(),
            })
    }

    const config = options?.config ?? await fetchDiscoverConfig()

    let hosts = config.mediaDatabases
        .filter(db => db.type === 'tvdb')
        .map(db => db.url)

    if (hosts.length === 0) {
        console.log(`No tvdb hosts found, using default host: ${SMM_TVDB_DEFAULT_UPSTREAM}`)
        hosts = [SMM_TVDB_DEFAULT_UPSTREAM]
    }

    return await fetchWithFailover(
        hosts,
        urlPath.startsWith('/') ? urlPath : `/${urlPath}`,
        {
            signal: options?.signal,
            _disabledDomains: options?.disabledDomains,
            _config: config,
        })
}
