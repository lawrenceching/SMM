export const extensions = {
    audioTrackFileExtensions: ['.mka'],
    videoFileExtensions: [
      // Common video formats
      '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v',
      // MPEG formats
      '.mpg', '.mpeg', '.m2v', '.m1v',
      // QuickTime formats
      '.qt', '.3gp', '.3g2',
      // RealMedia formats
      '.rm', '.rmvb', '.ra',
      // Windows Media formats
      '.asf', '.wm',
      // Ogg formats
      '.ogv', '.ogm',
      // Other formats
      '.vob', '.divx', '.f4v', '.h264', '.mxf', '.svi', '.tp', '.trp', '.wtv',
      // Transport streams
      '.ts', '.m2ts', '.mts',
      // Additional formats
      '.swf', '.yuv', '.m4p', '.m4b', '.m4r'
    ],
    subtitleFileExtensions: [
      // Common subtitle formats
      '.srt', '.ass', '.ssa', '.vtt', '.sub', '.idx',
      // SAMI formats
      '.smi', '.sami',
      // Other subtitle formats
      '.lrc', '.sbv', '.ttml', '.dfxp', '.stl', '.usf', '.dks', '.jss', '.pjs',
      '.psb', '.rt', '.s2k', '.sbt', '.scc', '.cap', '.cdg', '.scr', '.xas',
      '.mpl', '.mks', '.sup', '.aqt', '.gsub', '.vsf', '.zeg', '.cif', '.cip',
      '.ets', '.itk', '.slt', '.ssf', '.tds', '.txt'
    ],
    imageFileExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif', '.svg'],
    musicFileExtensions: ['.mp3', '.m4a', '.aac', '.ogg', '.wav', '.flac', '.ape', '.mka', '.wma', '.aac', '.m4a', '.ogg', '.wav', '.flac', '.ape']
  }
  
  export const videoFileExtensions = extensions.videoFileExtensions;
  export const imageFileExtensions = extensions.imageFileExtensions;
  export const subtitleFileExtensions = extensions.subtitleFileExtensions;

/**
 * Returns the full file extension for associated files (e.g. subtitles).
 * Preserves language/track suffixes so e.g. ".sc.ass" and ".tc.ass" are kept intact,
 * instead of collapsing to ".ass" (which would drop the language code).
 * Use this when building new filenames for associated files during rename.
 *
 * @param filePath - Absolute or relative path to the file
 * @returns Full extension including leading dot (e.g. ".sc.ass", ".ass", ".nfo")
 */
export function getFullExtensionForAssociatedFile(filePath: string): string {
  const name = filePath.replace(/^.*[/\\]/, '');
  const parts = name.split('.');
  if (parts.length < 2) return '';
  const baseExt = '.' + (parts.pop() ?? '');
  if (!extensions.subtitleFileExtensions.includes(baseExt)) {
    return baseExt;
  }
  if (parts.length < 2) return baseExt;
  const modifier = parts.pop() ?? '';
  if (/^[a-zA-Z0-9-]{2,10}$/.test(modifier)) {
    return '.' + modifier + baseExt;
  }
  return baseExt;
}