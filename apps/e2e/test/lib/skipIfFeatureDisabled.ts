import { featureToggles } from '@smm/types/featureToggles'

/** Skip the current Mocha suite when hello would report this product switch off. */
export function skipIfFeatureDisabled(
  ctx: { skip: () => void },
  feature: 'ytdlp' | 'videocaptioner',
): void {
  if (!featureToggles()[feature]) {
    ctx.skip()
  }
}
