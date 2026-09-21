import fs from 'node:fs';
import path from 'node:path';

export function resolveWebUiArtifactPaths(root: string) {
  const binName = process.platform === 'win32' ? 'cli.exe' : 'cli';
  const cliBin = path.join(root, 'apps', 'cli', 'dist', binName);
  const staticDir = path.join(root, 'apps', 'ui', 'dist');
  const indexHtml = path.join(staticDir, 'index.html');
  return { cliBin, staticDir, indexHtml };
}

export function assertWebUiArtifactsExist(root: string): void {
  const { cliBin, indexHtml } = resolveWebUiArtifactPaths(root);
  if (!fs.existsSync(cliBin)) {
    throw new Error(
      `--platform web needs a built CLI: run \`pnpm --filter cli run build\` (missing ${cliBin})`,
    );
  }
  if (!fs.existsSync(indexHtml)) {
    throw new Error(
      `--platform web needs a built UI: run \`pnpm --filter ui run build\` (missing ${indexHtml})`,
    );
  }
}
