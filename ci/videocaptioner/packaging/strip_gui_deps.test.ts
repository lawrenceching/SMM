import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = join(import.meta.dir, 'strip_gui_deps.py');

const SAMPLE = `[project]
name = "videocaptioner"
dependencies = [
    "requests>=2.32.4",
    "openai>=1.97.1",
    "PyQt5==5.15.11",
    "PyQt-Fluent-Widgets==1.8.4",
    "modelscope>=1.32.0",
    "psutil>=7.0.0",
    "GPUtil>=1.4.0",
    "pydub>=0.25.1",
]

[project.optional-dependencies]
gui = []
`;

describe('strip_gui_deps.py', () => {
  test('removes GUI hard-deps and keeps CLI deps', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vc-strip-'));
    const pyproject = join(dir, 'pyproject.toml');
    writeFileSync(pyproject, SAMPLE, 'utf8');

    const proc = Bun.spawnSync(['python', script, pyproject], {
      cwd: dir,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(proc.exitCode).toBe(0);

    const out = readFileSync(pyproject, 'utf8');
    expect(out).toContain('"requests>=2.32.4"');
    expect(out).toContain('"openai>=1.97.1"');
    expect(out).toContain('"pydub>=0.25.1"');
    expect(out).not.toContain('PyQt5');
    expect(out).not.toContain('modelscope');
    expect(out).not.toContain('psutil');
    expect(out).not.toContain('GPUtil');
  });
});
