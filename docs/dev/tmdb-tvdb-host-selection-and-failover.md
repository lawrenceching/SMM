# TMDB/TVDB host selection and failover

In order to improve the UX for users in different countries or regions, SMM test the performance of host candidates, and connects to hosts according to their performance.

## Speed Test

SMM do speed tests after start up, and maintain the four lists for TMDB and TVDB
```
// the TMDB API server hosts
const tmvdHostsPerformance = [
    { host: "host1.tmdb.example.com", score: 11 },
    { host: "host2.tmdb.example.com", score: 15 },
]
// the TVDB API server hosts
const tvdbHostsPerformance = [
    { host: "host1.tvdb.example.com", score: 11 },
    { host: "host2.tvdb.example.com", score: 15 },
]
// the TMDB asset(image) server hosts
const tmdbAssetServerPerformance = [...]
// the TVDB asset(image) server hosts
const tvdbAssetServerPerformance = [...]
```

1. start up
2. Calculate the TMDB/TVDB host lists by merging static config and remote config
3. Run speed test
4. Update tmvdHostsPerformance and tvdbHostsPerformance

**Speed Test**: send dummy HTTP request to TMDB and TVDB, and measure the duration. The duration in seconds is the score in performance list. So the score is the lower the better.

## Host Selection and Failover

When SMM try to connect to TMDB/TVDB:
1. Try the custom TMDB/TVDB host if provided in user config. and dont' need to failover. If custom TMDB/TVDB host failed, just stop and return.
2. if performance list is empty(which indicates speed test is running, skipped or failed), connects to hosts in the order of static config and remote config.
3. Try hosts in the order of performance list. If one failed, try next one.
4. For the host that succeeded, move the host to the top of the list, and mark score to 0. So next time, SMM always connects the host that have succeeded last time first.

**What is Failure** Only failure from TCP layer or below, is treated as failure and try next candidate. If It's HTTP layer failure, such as 404 or 500, treat it as success, move the host to to and stop.

## CLI

If SMM runs as [CLI](./supported-platform.md), Given that there is no such "start up" phase, the performance list is always empty.
So the host selection is actually disabled. This is expected.