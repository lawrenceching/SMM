import { extname } from 'path';
import vm from 'vm';
interface ExecutionContext {
    type: "tv" | "movie";
    seasonNumber: number;
    episodeNumber: number;
    episodeName: string;
    tvshowName: string;
    file: string
}

export const plex: string = `
const season = seasonNumber.toString().padStart(2, '0')
const episode = episodeNumber.toString().padStart(2, '0')
const folder = type === "tv" ? \`Season \${season}\` : "Specials";
const ext = extname(file);

return \`\${folder}/\${tvshowName} - S\${season}E\${episode} - \${episodeName}\${ext}\`
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