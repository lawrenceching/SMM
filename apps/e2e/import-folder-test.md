# Import Folder Test

> This is markdown file executed by google/zx

## Test Cases

```js
const supportedPlatforms = ['web', 'ohos', 'cli', 'electron', 'mcp', 'ai', 'all']

if(!supportedPlatforms.includes(argv.platform)) {
    console.error(`Unsupported platform "${argv.platform}". Valid values are ${JSON.stringify(supportedPlatforms)}`)
    process.exit(1)
}

process.env.TARGET_PLATFORM = argv.platform

```

### Web UI

```bash
if [ "$TARGET_PLATFORM" = "web" ] || [ "$TARGET_PLATFORM" = "all" ]; then
  bun ../../ci/run-e2e-test.ts --spec './common/tv/TVShow-Import.e2e.ts'
else
  echo "skipped: web"
fi
```


### Electron

```bash
if [ "$TARGET_PLATFORM" = "electron" ] || [ "$TARGET_PLATFORM" = "all" ]; then
  bun ../../ci/run-e2e-test.ts --spec './common/tv/TVShow-Import.e2e.ts' --platform electron
else
  echo "skipped: electron"
fi
```

### Ohos

```bash
if [ "$TARGET_PLATFORM" = "ohos" ] || [ "$TARGET_PLATFORM" = "all" ]; then
  bun ../../ci/run-e2e-test.ts --spec './common/tv/TVShow-Import.e2e.ts' --platform ohos
else
  echo "skipped: ohos"
fi
```

### CLI

```bash
if [ "$TARGET_PLATFORM" = "cli" ] || [ "$TARGET_PLATFORM" = "all" ]; then
  bun test cli/import-folder.test.ts
else
  echo "skipped: cli"
fi
```

### MCP


```bash
if [ "$TARGET_PLATFORM" = "mcp" ] || [ "$TARGET_PLATFORM" = "all" ]; then
  bun ../../ci/run-e2e-test.ts --spec './common/mcp\McpOther-RecognizeTaskFlow.e2e.ts'
else
  echo "skipped: mcp"
fi
```

### AI

```bash
if [ "$TARGET_PLATFORM" = "ai" ] || [ "$TARGET_PLATFORM" = "all" ]; then
  echo "no test cases"
else
  echo "skipped: ai"
fi
```


## References

[How to execute google/gz script](./README.md)
[Import Folder Requirement](../../docs/dev/import-folder.md)
