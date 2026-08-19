export interface FetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

/** Minimal HTTP response shape; runtime-agnostic (Node/browser). */
export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** Thin HTTP capability only. No business parsing here. */
export interface NetworkPort {
  fetch(input: string, init?: FetchInit): Promise<HttpResponse>;
}
