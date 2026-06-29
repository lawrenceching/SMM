const PLACEHOLDER = "******";

function clone<T>(value: T, seen: WeakSet<object>): T {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value as object)) return "[Circular]" as unknown as T;
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((v) => clone(v, seen)) as unknown as T;
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k === "apiKey" && typeof v === "string" && v !== "") {
      out[k] = PLACEHOLDER;
    } else {
      out[k] = clone(v, seen);
    }
  }
  return out as T;
}

export function redactUserConfig<T>(config: T): T {
  return clone(config, new WeakSet());
}
