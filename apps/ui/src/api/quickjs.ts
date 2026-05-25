import { probeWhitelistedCommand } from "@/lib/whitelistedCmd";
import { executeCmdToCompletion } from "@/lib/whitelistedCmd/executeCmdToCompletion";

export async function getQuickjsVersion(): Promise<{ version?: string; error?: string }> {
  const probe = await probeWhitelistedCommand("qjs");
  if (!probe.available) {
    return { error: probe.error ?? "QuickJS not found" };
  }
  const result = await executeCmdToCompletion(
    { command: "qjs", args: ["--version"] },
    { timeoutMs: 15_000 }
  );
  if (!result.success) {
    return { error: result.error };
  }
  return { version: result.stdout.trim() };
}
