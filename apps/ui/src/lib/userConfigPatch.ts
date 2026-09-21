import type { UserConfigPatchOperation } from "@smm/types";

/** One field update. `undefined` removes the field when it is currently set. */
export function setFieldPatch(
  path: string,
  value: unknown,
  previous: unknown,
): UserConfigPatchOperation | null {
  if (value === undefined) {
    if (previous === undefined) return null;
    return { op: "remove", path };
  }
  if (Object.is(value, previous)) return null;
  return { op: "add", path, value };
}
