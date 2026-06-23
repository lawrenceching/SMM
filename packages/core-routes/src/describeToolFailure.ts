/**
 * Serialize an unknown thrown value for structured tool/MCP logs.
 * HarmonyOS native bindings sometimes reject with plain objects
 * rather than `Error` instances.
 */
export function describeToolFailure(error: unknown): {
  message: string;
  errorType: string;
  stack?: string;
  raw: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      errorType: error.constructor.name,
      stack: error.stack,
      raw: String(error),
    };
  }

  if (typeof error === "string") {
    return { message: error, errorType: "string", raw: error };
  }

  if (error === null || error === undefined) {
    return {
      message: "null or undefined thrown",
      errorType: String(error),
      raw: String(error),
    };
  }

  try {
    const json = JSON.stringify(error);
    return {
      message: json && json !== "{}" ? json : String(error),
      errorType: typeof error,
      raw: json ?? String(error),
    };
  } catch {
    return {
      message: String(error),
      errorType: typeof error,
      raw: String(error),
    };
  }
}
