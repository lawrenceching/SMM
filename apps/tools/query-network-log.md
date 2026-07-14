query-network-log is the tool to query network log captured by the wdio e2e test.

For AI Agent, the network log is too huge to read.
It's suggested to query log in below steps:

1. Query by "urlStartsWith" filter

query-network-log filter and print the matched request line by line, in format `[request-id] [request-url]`
```
$ bun apps/tools/query-network-log.ts -f ./artifacts/cicd/1783705247/SearchTvShow.e2e.ts/network-log/sample.json --urlStartsWith "http://localhost:5173/?token"

D3F3BF542A03B653286418A78F9F40D7 http://localhost:5173/?token=xxx
```

2. Query request details by request id
```
$ bun apps/tools/query-network-log.ts -f ./artifacts/cicd/1783705247/Search
TvShow.e2e.ts/network-log/SearchTvShow.e2e.ts-0-0.json --request-id '22384.
682'   --output-format "curl-like"
> POST /api/hello HTTP/1.1
> sec-ch-ua-platform: "Windows"
> authorization: Bearer ChangeMe123
> Referer: http://localhost:5173/?token=ChangeMe123
> Accept-Language: zh-CN,zh;q=0.9
> sec-ch-ua: "Not-A.Brand";v="24", "Chromium";v="146"
> User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36(KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36
> sec-ch-ua-mobile: ?0
> Accept: */*
> Accept-Encoding: gzip, deflate, br, zstd
> Connection: keep-alive
> Content-Length: 0
> Host: localhost:5173
> Origin: http://localhost:5173
> Sec-Fetch-Dest: empty
> Sec-Fetch-Mode: cors
> Sec-Fetch-Site: same-origin
>
< HTTP/1.1 200 OK
< x-request-id: 35347142-081e-45e3-b0d1-a3755797b07d
< access-control-expose-headers: X-Command-Execution-Id,X-Command-Log-Path,X-Resolved-Executable-Path
< connection: keep-alive
< access-control-allow-origin: *
< content-length: 334
< date: Fri, 10 Jul 2026 17:41:03 GMT
< content-type: application/json
< Vary: Origin
<
(not captured, 334 bytes)
```

**NOTE** request and response body is too large to captured. They don't exist in network log.