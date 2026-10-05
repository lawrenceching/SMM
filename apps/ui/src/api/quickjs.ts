import { probeWhitelistedCommand } from "@/lib/whitelistedCmd";
import { executeCmdToCompletion } from "@/lib/whitelistedCmd/executeCmdToCompletion";

/** Parse `QuickJS version YYYY-MM-DD` from qjs `-h` / error output. */
export function parseQuickjsVersionOutput(text: string): string | undefined {
  const match = text.match(/QuickJS version\s+(\S+)/i);
  return match?.[1];
}

export async function getQuickjsVersion(): Promise<{ version?: string; error?: string }> {
  const probe = await probeWhitelistedCommand("qjs");
  if (!probe.available) {
    return { error: probe.error ?? "QuickJS not found" };
  }
  // qjs does not support `--version`; `-h` prints "QuickJS version …" but exits 1.
  const result = await executeCmdToCompletion(
    { command: "qjs", args: ["-h"] },
    { timeoutMs: 15_000 }
  );
  const version = parseQuickjsVersionOutput(`${result.stdout}\n${result.stderr}`);
  if (version) {
    return { version };
  }
  return { error: result.error ?? "QuickJS version not found in -h output" };
}
