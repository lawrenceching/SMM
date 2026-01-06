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
  }
  scrape: {
    title: string
  }
}

interface SettingsResources {
  title: string
  general: {
    title: string
    language: string
    languageDescription: string
  }
  ai: {
    title: string
  }
  renameRules: {
    title: string
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

