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
    config: string
    exit: string
    downloadVideo: string
  }
  sidebar: {
    mediaFolders: string
    addFolder: string
  }
  toolbar: {
    refresh: string
    settings: string
  }
  mediaFolder: {
    rename: string
    openInExplorer: string
    delete: string
    deleteWarning: string
    renameTitle: string
    renameDescription: string
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
  }
  scrape: {
    title: string
    defaultTitle: string
    defaultDescription: string
    status: {
      running: string
      completed: string
      failed: string
      pending: string
    }
    noTasks: string
    start: string
  }
  errors: {
    providerError: string
  }
}

interface SettingsResources {
  title: string
  general: {
    title: string
    language: string
    languageDescription: string
    tmdbHost: string
    tmdbHostPlaceholder: string
    tmdbApiKey: string
    tmdbApiKeyPlaceholder: string
    httpProxy: string
    httpProxyPlaceholder: string
  }
  ai: {
    title: string
    description: string
    selectProvider: string
    selectProviderPlaceholder: string
    searchPlaceholder: string
    noProviderFound: string
    configuration: string
    baseUrl: string
    baseUrlPlaceholder: string
    apiKey: string
    apiKeyPlaceholder: string
    model: string
    modelPlaceholder: string
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

