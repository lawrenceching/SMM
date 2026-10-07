declare const Bun: {
  serve(options: {
    hostname: string
    port: number
    fetch: (req: Request) => Promise<Response>
  }): { hostname: string; port: number; stop(): void }
  file(path: string): {
    exists(): Promise<boolean>
    text(): Promise<string>
    json(): Promise<unknown>
  }
  write(path: string, data: string): Promise<number>
}
