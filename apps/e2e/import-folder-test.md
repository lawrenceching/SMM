# Import Folder Test

> This is markdown file executed by google/zx

```js
const supportedPlatforms = ['web', 'ohos', 'cli', 'electron', 'mcp', 'ai']

if(!supportedPlatforms.includes(argv.platform)) {
    console.error(`Unsupported platform "${argv.platform}". Valid values are ${JSON.stringify(supportedPlatforms)}`)
    process.exit(1)
}

process.env.TARGET_PLATFORM = argv.platform

```

## Test Cases for Web UI

```bash
if [ "$TARGET_PLATFORM" = "web" ]; then
  bun ../../ci/run-e2e-test.ts --spec './common/tv/TVShow-Import.e2e.ts'
else
  echo 'skipped: web'
fi
```

