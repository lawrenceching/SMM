import { rpc, unwrapJson } from "@/lib/rpc";

type DiscoverExecutablesResponseBody = Awaited<
  ReturnType<Awaited<ReturnType<(typeof rpc)["api"]["discoverExecutables"]["$get"]>>["json"]>
>;

export type DiscoverExecutablesData = DiscoverExecutablesResponseBody["data"];

export type ExecutablePathInfo = DiscoverExecutablesData["ffmpeg"];

/** Relative `/api` so Vite proxy + authenticated fetch apply in `pnpm dev`. */
export async function fetchDiscoverExecutables(): Promise<DiscoverExecutablesData> {
  const response = await rpc.api.discoverExecutables.$get();
  const body = await unwrapJson(response);
  return body.data;
}
