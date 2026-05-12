import 'i18next'

// Type definitions for translation resources
// These match the structure of the JSON files in public/locales/
interface CommonResources {
  save: string
  cancel: string
  delete: string
  edit: string
  add: string
  remove: string
  confirm: string
  close: string
  open: string
  search: string
  filter: string
  sort: string
  refresh: string
  loading: string
  error: string
  success: string
  warning: string
  info: string
  yes: string
  no: string
  ok: string
  apply: string
  reset: string
  back: string
  next: string
  previous: string
  finish: string
}

interface ComponentsResources {
  menu: {
    file: string
    edit: string
    view: string
    help: string
    openFolder: string
    openMediaLibrary: string
    developer: string
    openAppDataFolder: string
    openLogFolder: string
    openExecuteCmd: string
    config: string
    cleanUp: string
    exit: string
    downloadVideo: string
    formatConversion: string
  }
  sidebar: {
    mediaFolders: string
    addFolder: string
  }
  folderNotAvailablePanel: {
    title: string
    description: string
  }
  toolbar: {
    refresh: string
    settings: string
    plex: string
    emby: string
    confirm: string
    cancel: string
    selectPlaceholder: string
    generating: string
    aiGenerating: string
    aiRenaming: string
    aiReview: string
    aiRecognizing: string
    aiReviewEpisodes: string
    reviewRecognizeEpisodes: string
    useNfoMetadata: string
    useTmdbIdFromFolderName: string
    queryingTmdb: string
    queryTmdbFailed: string
    recognizeEpisodesSuccess: string
  }
  mediaFolder: {
    rename: string
    openInExplorer: string
    delete: string
    deleteWarning: string
    renameTitle: string
    renameDescription: string
    renameError: string
    initializing: string
    folderNotFound: string
    errorLoadingMetadata: string
  }
  assistant: {
    open: string
    close: string
  }
  tvShow: {
    searchPlaceholder: string
    searchPlaceholderUnrecognized: string
    overview: string
    genres: string
    genreLabel: string
    rename: string
    recognize: string
    scrape: string
    notAvailable: string
  }
  tmdbSearchbox: {
    database: string
    searchLanguage: string
    tvdbSearchOnlyHint: string
  }
  movie: {
    searchPlaceholder: string
    searchPlaceholderUnrecognized: string
    overview: string
    genres: string
    genreLabel: string
    rename: string
    scrape: string
    notAvailable: string
    searchNoResults: string
    searchFailed: string
    noMediaPathError: string
  }
  episodeFile: {
    open: string
    rename: string
    renameSuccess: string
    renameFailed: string
    selectFile: string
  }
  viewSwitcher: {
    metadataView: string
    filesView: string
  }
  fileExplorer: {
    root: string
    current: string
    searchPlaceholder: string
    loading: string
    loadFailed: string
    errorTitle: string
    noMatches: string
    emptyDirectory: string
    noMatchesDescription: string
    emptyDirectoryDescription: string
    statusBar: string
    searchStatus: string
    folderContents: string
    goToParent: string
    drives: string
    drivesStatus: string
    driveSelector: string
    driveSelectorPlaceholder: string
    home: string
  }
  episodeSection: {
    notAvailable: string
    minutes: string
    noFiles: string
    deleted: string
    fileTypes: {
      video: string
      subtitle: string
      audio: string
      nfo: string
      poster: string
      file: string
    }
  }
  thread: {
    welcome: {
      title: string
      subtitle: string
      configNotComplete: string
      openSettings: string
    }
    suggestions: {
      recognizeVideoFiles: {
        title: string
        label: string
        prompt: string
      }
      organizeFiles: {
        title: string
        label: string
        prompt: string
      }
    }
    clearChat: string
    clearChatTooltip: string
  }
  statusBar: {
    mcp: {
      serverOn: string
      serverOff: string
      title: string
      subtitle: string
      turnOff: string
      turnOn: string
      address: string
      protocol: string
      protocolValue: string
      disabledMessage: string
      documentation: string
    }
    database: {
      title: string
      subtitle: string
      tmdb: string
      tvdb: string
      connected: string
      disconnected: string
      checking: string
      warningAriaLabel: string
    }
    messages: {
      tmdbAvailable: string
      tmdbUnavailable: string
      tvdbAvailable: string
      tvdbUnavailable: string
      videoCaptionerAvailable: string
      videoCaptionerNotFound: string
      transcribeUnavailableOnOs: string
      learnMore: string
    }
    backgroundJobs: {
      title: string
      subtitle: string
      empty: string
      triggerAriaLabel: string
      triggerAriaLabel_one: string
      triggerAriaLabel_other: string
      abortAriaLabel: string
      status: {
        pending: string
        running: string
        succeeded: string
        failed: string
        aborted: string
      }
      messages: {
        succeeded: string
        failed: string
        aborted: string
      }
    }
  }
  mediaPlayer: {
    select: string
    download: string
    transcribingTooltip: string
    transcribeFailedTooltip: string
    translateRunningTooltip: string
    translateFailedTooltip: string
    synthesizeRunningTooltip: string
    synthesizeFailedTooltip: string
    trackContextMenu: {
      open: string
      delete: string
      properties: string
      editTags: string
      formatConvert: string
      downloadStart: string
      downloadStop: string
      downloadRemove: string
      subtitle: string
      transcribe: string
      transcribeStop: string
      translate: string
      translateStop: string
      synthesize: string
      synthesizeStop: string
    }
    noTracksFound: string
    tryAdjustingFilter: string
  }
  subtitleTranslationDialog: {
    title: string
    description: string
    translator: string
    translators: {
      bing: string
      google: string
      llm: string
    }
    targetLanguage: string
    reflect: string
    apiKey: string
    apiBase: string
    model: string
    layout: string
    layoutOptional: string
    layoutNone: string
    confirm: string
    cancel: string
    noSubtitleFile: string
    toastStart: string
    toastSucceeded: string
    toastFailed: string
  }
  synthesizeSubtitleDialog: {
    title: string
    description: string
    subtitleMode: string
    subtitleModes: {
      soft: string
      hard: string
    }
    quality: string
    qualities: {
      ultra: string
      high: string
      medium: string
      low: string
    }
    style: string
    stylePlaceholder: string
    renderMode: string
    renderModeDefault: string
    renderModes: {
      ass: string
      rounded: string
    }
    layout: string
    layoutDefault: string
    confirm: string
    cancel: string
    noSubtitleFile: string
    notVideoFile: string
    toastStart: string
    toastSucceeded: string
    toastFailed: string
  }
  tvShowEpisodeTable: {
    columns: {
      id: string
      video: string
      thumbnail: string
      subtitle: string
      nfo: string
    }
    header: {
      videoFile: string
      thumb: string
      sub: string
    }
    contextMenu: {
      showColumns: string
      unlink: string
      editTags: string
      notImplemented: string
    }
    unlinkSuccess: string
    unlinkFailed: string
    expand: string
    collapse: string
    noFile: string
  }
  musicFileTable: {
    columns: {
      index: string
      cover: string
      title: string
      artist: string
      duration: string
    }
  }
  movieEpisodeTable: {
    columns: {
      file: string
      thumbnail: string
      subtitle: string
      nfo: string
    }
    header: {
      type: string
      file: string
      poster: string
      sub: string
      nfo: string
    }
    rowTypes: {
      video: string
      poster: string
      sub: string
      nfo: string
    }
    contextMenu: {
      showColumns: string
    }
    noFilesFound: string
  }
}

interface DialogsResources {
  confirmation: {
    title: string
    defaultMessage: string
  }
  settings: {
    title: string
  }
  rename: {
    title: string
    defaultTitle: string
    defaultDescription: string
    fileDescription: string
    newNameLabel: string
    placeholder: string
    suggestions: string
  }
  filePicker: {
    defaultTitle: string
    defaultDescription: string
  }
  downloadVideo: {
    title: string
    description: string
    urlLabel: string
    folderLabel: string
    folderPlaceholder: string
    downloading: string
    start: string
    agreementTitle: string
    agreementDescription: string
    agreementCheckboxLabel: string
    agreementRequiredNotice: string
    downloadEpisodesLabel: string
    getVideos: string
    collectionVideosLoading: string
    episodesLoading: string
    episodesNoneSelected: string
    episodesNoVideoUrls: string
    downloadedTo: string
    episodesDownloadsFinished: string
    backgroundQueued: string
    backgroundJobEpisodesName: string
    validation: {
      URL_EMPTY: string
      URL_INVALID: string
      URL_PLATFORM_NOT_ALLOWED: string
    }
  }
  scrape: {
    title: string
    defaultTitle: string
    defaultDescription: string
    mediaTitle: string
    mediaDescription: string
    columns: {
      file: string
      status: string
    }
    tasks: {
      poster: string
      fanart: string
      thumbnails: string
      nfo: string
    }
    status: {
      running: string
      completed: string
      failed: string
      pending: string
    }
    noTasks: string
    start: string
    done: string
  }
  transcribe: {
    defaultTitle: string
    defaultDescription: string
    columns: {
      filePath: string
    }
    advancedOptions: {
      label: string
    }
    noFiles: string
    confirm: string
    selectAllAria: string
    asr: {
      label: string
      bijian: string
      jianying: string
      whisperCpp: string
    }
    provider: {
      label: string
      videoCaptioner: string
      tencentAsr: string
    }
    language: {
      label: string
      placeholder: string
    }
    wordTimestamps: {
      label: string
    }
    format: {
      label: string
      srt: string
      ass: string
      txt: string
      json: string
    }
    tencent: {
      baseUrl: string
      apiKey: string
    }
  }
  editMediaFile: {
    title: string
    description: string
    fields: {
      title: string
      artist: string
      comment: string
      date: string
    }
    save: string
    saving: string
    saveSuccess: string
    saveFailed: string
    loadFailed: string
  }
  openFolder: {
    title: string
    description: string
    folderPathLabel: string
    types: {
      tvshow: {
        label: string
        description: string
      }
      movie: {
        label: string
        description: string
      }
      music: {
        label: string
        description: string
      }
    }
  }
  errors: {
    providerError: string
  }
  fileProperty: {
    title: string
    artist: string
    album: string
    genre: string
    duration: string
    estimatedSize: string
    addedDate: string
    preview: string
    convertFormat: string
  }
  formatConverter: {
    title: string
    description: string
    sourceLabel: string
    selectVideo: string
    outputFormatLabel: string
    formatMp4H264: string
    formatMp4H265: string
    formatWebm: string
    formatMkv: string
    presetLabel: string
    presetQuality: string
    presetBalanced: string
    presetSpeed: string
    saveToLabel: string
    browse: string
    outputFileNameLabel: string
    start: string
    duration: string
    noSourceHint: string
    uiOnlyHint: string
    invalidParams: string
    success: string
  }
  executeCmd: {
    title: string
    description: string
    command: string
    selectCommand: string
    arguments: string
    addArgument: string
    output: string
    running: string
    clear: string
    noOutput: string
    execute: string
    stop: string
  }
}

interface SettingsResources {
  title: string
  general: {
    title: string
    language: string
    languageDescription: string
    theme: string
    themeDescription: string
    themeLight: string
    themeDark: string
    themeSystem: string
    tmdbHost: string
    tmdbHostPlaceholder: string
    tmdbApiKey: string
    tmdbApiKeyPlaceholder: string
    primaryDatabase: string
    primaryDatabaseDescription: string
    primaryDatabaseTmdb: string
    primaryDatabaseTvdb: string
    preferMediaLanguage: string
    preferMediaLanguageDescription: string
    preferMediaLanguageUnset: string
    preferMediaLanguageZhCn: string
    preferMediaLanguageEnUs: string
    preferMediaLanguageJaJp: string
    tvdbHost: string
    tvdbHostPlaceholder: string
    tvdbApiKey: string
    tvdbApiKeyPlaceholder: string
    httpProxy: string
    httpProxyPlaceholder: string
    enableMcpServer: string
    enableMcpServerDescription: string
    mcpHost: string
    mcpHostPlaceholder: string
    mcpPort: string
    mcpPortPlaceholder: string
    externalTools: string
    externalToolsDescription: string
    ytdlpExecutablePath: string
    ytdlpExecutablePathPlaceholder: string
    selectYtdlpExecutable: string
    selectYtdlpExecutableDescription: string
    ffmpegExecutablePath: string
    ffmpegExecutablePathPlaceholder: string
    selectFfmpegExecutable: string
    selectFfmpegExecutableDescription: string
    videoCaptionerExecutablePath: string
    videoCaptionerExecutablePathUnavailable: string
    useBundledFfmpegForVideoCaptioner: string
    browse: string
  }
  ai: {
    title: string
    description: string
    noProviders: string
    providerName: string
    providerNamePlaceholder: string
    setActive: string
    addProvider: string
    deleteProvider: string
    nameRequired: string
    nameDuplicate: string
    baseUrl: string
    baseUrlPlaceholder: string
    apiKey: string
    apiKeyPlaceholder: string
    model: string
    modelPlaceholder: string
    check: string
    checkChecking: string
    checkSuccess: string
    checkError: string
  }
  feedback: {
    title: string
    description: string
    type: string
    typeBug: string
    typeFeature: string
    typeImprovement: string
    typeOther: string
    message: string
    messagePlaceholder: string
    send: string
  }
  renameRules: {
    title: string
    description: string
    addRule: string
    selectedRule: string
    selectPlaceholder: string
    noRulesAvailable: string
    availableRules: string
    emptyState: string
  }
  sidebar: {
    title: string
    general: string
    ai: string
    renameRules: string
    feedback: string
  }
}

interface ErrorsResources {
  generic: string
  networkError: string
  fileNotFound: string
  permissionDenied: string
  invalidInput: string
  operationFailed: string
  searchNoResults: string
  searchFailed: string
}

interface ValidationResources {
  required: string
  invalidEmail: string
  invalidUrl: string
  minLength: string
  maxLength: string
}

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: {
      common: CommonResources
      components: ComponentsResources
      dialogs: DialogsResources
      settings: SettingsResources
      errors: ErrorsResources
      validation: ValidationResources
    }
  }
}

