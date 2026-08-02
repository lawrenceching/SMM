/** Fetch-compatible input without requiring DOM lib in tsconfig. */
export type FetchInput = string | URL | Request;

/** Minimal fetch signature shared across Node, Bun, and test mocks. */
export type FetchLike = (
  input: FetchInput,
  init?: RequestInit,
) => Promise<Response>;

/** Normalize input for runtimes whose Request ctor only accepts string (e.g. Bun). */
export function toRequest(input: FetchInput, init?: RequestInit): Request {
  if (input instanceof Request) {
    return init !== undefined ? new Request(input, init) : input;
  }
  const url = typeof input === "string" ? input : input.href;
  return new Request(url, init);
}
