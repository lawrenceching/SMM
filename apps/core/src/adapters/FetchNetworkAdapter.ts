import type { FetchInit, HttpResponse, NetworkPort } from "../ports/NetworkPort";

export class FetchNetworkAdapter implements NetworkPort {
  private readonly fetchImpl: (input: string, init?: FetchInit) => Promise<HttpResponse>;

  constructor(fetchImpl?: (input: string, init?: FetchInit) => Promise<HttpResponse>) {
    this.fetchImpl =
      fetchImpl ??
      ((input, init) => {
        // Node 18+ / modern browsers expose globalThis.fetch returning a Response
        // whose runtime shape satisfies HttpResponse.
        const g = globalThis as unknown as {
          fetch: (i: string, o?: FetchInit) => Promise<HttpResponse>;
        };
        return g.fetch(input, init);
      });
  }

  fetch(input: string, init?: FetchInit): Promise<HttpResponse> {
    return this.fetchImpl(input, init);
  }
}
