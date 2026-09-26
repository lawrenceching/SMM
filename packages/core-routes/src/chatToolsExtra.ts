import type { RenameFilesPlan } from "@smm/types/RenameFilesPlan";
import type { RecognizeMediaFilePlan } from "@smm/types/RecognizeMediaFilePlan";
import type { RenameEpisodeFileRunner } from "./tools/renameEpisodeFile.ts";
import type { ScrapeFolderRunner } from "./tools/scrape.ts";
import type { GetJobRunner } from "./tools/getJob.ts";
import type { TmdbToolRunners } from "./tools/tmdb.ts";
import type { TvdbToolRunners } from "./tools/tvdb.ts";

/**
 * Extra dependencies the host (cli / ohos) injects so the chat
 * tools can run inside core-routes.
 */
export interface ChatToolsExtraDeps {
  renameEpisodeFile?: RenameEpisodeFileRunner;
  scrapeFolder?: ScrapeFolderRunner;
  getJob?: GetJobRunner;
  tmdb?: TmdbToolRunners;
  tvdb?: TvdbToolRunners;
  applyRenameEpisodePlan?: (plan: RenameFilesPlan) => Promise<void>;
  applyRecognizeEpisodePlan?: (plan: RecognizeMediaFilePlan) => Promise<void>;
}
