export interface ConvexSettings {
  latestVersion?: string;
}

export function getConvexSiteUrl(): string | undefined {
  const url = (import.meta.env.VITE_CONVEX_SITE_URL as string | undefined)?.trim();
  return url || undefined;
}

export async function fetchConvexSettings(): Promise<ConvexSettings> {
  const baseUrl = getConvexSiteUrl();
  if (!baseUrl) {
    return {};
  }
  const url = `${baseUrl.replace(/\/$/, "")}/api/settings`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Convex settings request failed: ${resp.status}`);
  }
  const data = (await resp.json()) as Record<string, string>;
  return {
    latestVersion: data.latestVersion,
  };
}
