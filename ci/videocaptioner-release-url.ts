/**
 * VideoCaptioner SMM Release URL helpers.
 *
 * Artifact / Release tag version is `{upstream}_{smm_build}` (e.g. `1.4.2_1.0.2`).
 * Upstream version is normalized (strip leading `v`, strip hatch-vcs `.dev…` suffix).
 */

export function normalizeVideocaptionerUpstreamVersion(raw: string): string {
  let v = raw.trim();
  if (!v) {
    throw new Error('upstream version is empty');
  }

  // git describe --long: v1.4.2-0-gabc1234 or 1.4.2-5-gabcdef0
  const long = /^(v)?(.+)-(\d+)-g[0-9a-f]+$/i.exec(v);
  if (long?.[2]) {
    v = long[2];
  } else if (/^v/i.test(v)) {
    v = v.slice(1);
  }

  // hatch-vcs dirty: 1.4.2.dev3+gabc → 1.4.2 (matches upstream config.py)
  v = v.split('.dev')[0] ?? v;
  v = v.trim();
  if (!v) {
    throw new Error(`upstream version normalized to empty from: ${raw}`);
  }
  return v;
}

export function videocaptionerArtifactVersion(
  upstreamVersion: string,
  smmBuildVersion: string,
): string {
  const upstream = normalizeVideocaptionerUpstreamVersion(upstreamVersion);
  const smm = smmBuildVersion.trim();
  if (!smm) {
    throw new Error('smm build version is empty');
  }
  return `${upstream}_${smm}`;
}

export function videocaptionerReleaseTag(artifactVersion: string): string {
  return `videocaptioner-${artifactVersion}`;
}

export function videocaptionerReleaseAssetUrl(args: {
  releasesRepo: string;
  artifactVersion: string;
  suffix: string;
}): string {
  const tag = videocaptionerReleaseTag(args.artifactVersion);
  const asset = `videocaptioner-${args.artifactVersion}-${args.suffix}.tar.gz`;
  return `https://github.com/${args.releasesRepo}/releases/download/${tag}/${asset}`;
}
