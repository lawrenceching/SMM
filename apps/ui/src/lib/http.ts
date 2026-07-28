import type { DiscoverConfig } from "../api/discover"
import { zip } from "es-toolkit"
import { isEmpty } from "es-toolkit/compat"
import localStorages from "./localStorages"
import { fetchDiscoverConfig } from "../api/discover"
import { clearDisabledDomains } from "../api/tmdb"
// TODO: Remove once reverse proxy support is fully removed.
// import staticConfig from "@/api/staticConfig"

export class HttpFailoverExhaustedError extends Error {
    readonly baseUrls: string[]

    constructor(baseUrls: string[]) {
        super("All HTTP failover attempts failed")
        this.name = "HttpFailoverExhaustedError"
        this.baseUrls = baseUrls
    }
}

export function getDomainName(url: string): string {
    try {
        return new URL(url).hostname
    } catch {
        return ''
    }
}

export async function fetchWithFailover(
    baseUrls: string[],
    urlPath: string, 
    options?: {
        signal?: AbortSignal,
        _disabledDomains?: Set<string> // only for unit test
        _config?: DiscoverConfig // only for unit test
  }) {
      const disabledDomains = options?._disabledDomains ?? localStorages.disabledDomains;

      let validBaseUrls = baseUrls.filter(url => {
        try {
          const hostname = new URL(url).hostname
          return !disabledDomains.has(hostname)
        } catch {
          return true
        }
      })

      if(validBaseUrls.length === 0) {
        console.log(`All base urls are disabled`)
        // domain in disabledDomains are marked as "Not able to connect"
        // If all base urls are disabled, it's more likely to be a network issue instead of remote server issue
        // Therefore, in this case, we treat all base urls as valid(imply no connectivitiy issue for there urls)
        validBaseUrls = baseUrls;
      }

      const config: DiscoverConfig = options?._config ?? await fetchDiscoverConfig()
      const reverseProxies = config.reverseProxies
        .filter(proxy => URL.canParse(proxy.url))
        .filter(proxy => {
          try {
            const hostname = new URL(proxy.url!).hostname
            return !disabledDomains.has(hostname)
          } catch {
            return true
          }
        })
  
      // TODO: Reverse proxy support is deprecated and will be removed entirely.
      // The fallback to default external reverse proxy has been disabled.
      // When reverseProxies is empty, the failover chain will only contain direct fetches.
      // if(reverseProxies.length === 0) {
      //   const defaultProxy = staticConfig.defaultExternalReverseProxy;
      //   console.log(`No reverse proxies found, using default reverse proxy: ${defaultProxy.url}`)
      //   reverseProxies = [{
      //       id: 'default',
      //       type: 'general',
      //       url: defaultProxy.url,
      //       authorizationMethod: defaultProxy.authorizationMethod,
      //   } as ReverseProxyEndpoint]
      // }
   
      const chain = [];

      for(const [upstreamBasedUrl, proxy] of zip(validBaseUrls, reverseProxies)) {
        // es-toolkit zip pads the shorter array with null — skip incomplete pairs
        if (!upstreamBasedUrl || !proxy?.url) {
          continue
        }
        chain.push({
          url: upstreamBasedUrl,
          proxy: proxy.url,
          fn: async () => {

            const headers: Record<string, string> = {
              'X-Upstream-Base-Url': upstreamBasedUrl,
            }
            if(proxy.authorizationMethod === 'date-token') {
              // For example, 20260710 (UTC)
              const now = new Date()
              const yyyyMMdd = [
                now.getUTCFullYear(),
                String(now.getUTCMonth() + 1).padStart(2, '0'),
                String(now.getUTCDate()).padStart(2, '0'),
              ].join('')
              headers['X-Proxy-Authorization'] = `Bearer ${yyyyMMdd}`
            }

              const resp = await fetch(proxy.url!, {
                method: 'GET',
                headers,
                signal: options?.signal,
              })
              if (!resp.ok) {
                throw new Error(`Reverse proxy returned HTTP ${resp.status}`)
              }
              return resp

          }
        })
      }

      for(const baseUrl of validBaseUrls) {
        chain.push({
          url: baseUrl,
          proxy: undefined,
          fn: async () => {
              return await fetch(`${baseUrl}${urlPath}`, {
                signal: options?.signal,
              })
          }
        })
      }

      if(chain.length === 0) {
        // This should never happen
        console.error('empty request chain!')
        throw new Error('Empty Request Chain')
      }

      for(const { url, proxy, fn } of chain) {
        try {
          return await fn()
        } catch (error) {
          if (
            (error instanceof DOMException && error.name === 'AbortError') ||
            (error instanceof Error && error.name === 'AbortError')
          ) {
            throw error
          }
  
          if(!isEmpty(url) && isEmpty(proxy)) {
            const domain = getDomainName(url)
            if(!isEmpty(domain)) {
              const next = localStorages.disabledDomains
              next.add(domain)
              localStorages.disabledDomains = next
              console.log(`Added "${domain}" to disabled domains due to error: ${error}`)
            } else {
              console.error(`Failed to get domain name from "${url}"`)
            }
          }
  
          if(!isEmpty(proxy)) {
            const domain = getDomainName(proxy!)
            if(!isEmpty(domain)) {
              const next = localStorages.disabledDomains
              next.add(domain)
              localStorages.disabledDomains = next
              console.log(`Added "${domain}" to disabled domains due to error: ${error}`)
            } else {
              console.error(`Failed to get domain name from "${proxy!}"`)
            }
          }
  
          console.info(`Unable to connect to url "${url}", proxy "${proxy}": ${error}`)
          console.log(`Failover to next url/proxy...`)
        }
      }
  
      // All attempts to media-database hosts and all reverse proxies failed
      // clear disabled domains to avoid all domains got banned
      const domainForHosts = baseUrls
        .map(url => getDomainName(url))

      const domainForReverseProxies = reverseProxies
        .map(proxy => getDomainName(proxy.url!))
  
      clearDisabledDomains([...domainForHosts, ...domainForReverseProxies])
      console.log(`Removed domains from disabledDomains: ${domainForHosts.join(', ')} and ${domainForReverseProxies.join(', ')}`)
      throw new HttpFailoverExhaustedError(baseUrls)
}