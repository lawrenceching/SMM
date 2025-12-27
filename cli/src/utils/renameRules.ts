import { logger } from 'hono/logger';
import { extname } from 'path';
import vm from 'vm';
interface ExecutionContext {
    type: "tv" | "movie";
    seasonNumber: number;
    episodeNumber: number;
    episodeName: string;
    tvshowName: string;
    file: string;
    tmdbId: string;
    releaseYear: string;
}

/**
 * The JavaScript code to generate file name by Plex rename rule
 */
export const plex: string = `
const ext = extname(file);
if (type === "movie") {
  const year = releaseYear || "";
  return \`\${episodeName}\${year ? \` (\${year})\` : ""}\${ext}\`;
} else {
  const season = seasonNumber.toString().padStart(2, '0');
  const episode = episodeNumber.toString().padStart(2, '0');
  const folder = \`Season \${season}\`;
  return \`\${folder}/\${tvshowName} - S\${season}E\${episode} - \${episodeName}\${ext}\`;
}
`

/**
 * The JavaScript code to generate file name by Emby rename rule
 */
export const emby: string = `
const ext = extname(file);
if (type === "movie") {
  const year = releaseYear || "";
  return \`\${episodeName}\${year ? \` (\${year})\` : ""}\${ext}\`;
} else {
  const season = seasonNumber.toString()
  const episode = episodeNumber.toString()
  const folder = \`Season \${season}\`;
  return \`\${folder}/\${tvshowName} S\${season}E\${episode} \${episodeName}\${ext}\`;
}
`

export function generateFileNameByJavaScript(code: string, context: ExecutionContext): string {
    const vmContext = {
        ...context,
        extname: extname
    }
    try {
        const result = vm.runInNewContext(`(function() { ${code} })()`, vmContext);
        return result;
    } catch (error) {
        // Re-throw with original code context for better debugging
        const enhancedError = new Error(
            `Error executing rename rule code:\n${code}\n\nOriginal error: ${error instanceof Error ? error.message : String(error)}`
        );
        if (error instanceof Error && error.stack) {
            enhancedError.stack = error.stack;
        }
        throw enhancedError;
    }
}