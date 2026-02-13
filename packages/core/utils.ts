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