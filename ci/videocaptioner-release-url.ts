export function videocaptionerReleaseTag(version: string): string {
  return `videocaptioner-${version}`;
}

export function videocaptionerReleaseAssetUrl(args: {
  releasesRepo: string;
  version: string;
  suffix: string;
}): string {
  const tag = videocaptionerReleaseTag(args.version);
  const asset = `videocaptioner-${args.version}-${args.suffix}.tar.gz`;
  return `https://github.com/${args.releasesRepo}/releases/download/${tag}/${asset}`;
}
