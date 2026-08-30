export class MetadataNotFoundError extends Error {
  readonly folderPath: string

  constructor(folderPath: string) {
    super(`Metadata not found: ${folderPath}`)
    this.name = "MetadataNotFoundError"
    this.folderPath = folderPath
  }
}

export class MetadataAlreadyExistsError extends Error {
  readonly folderPath: string

  constructor(folderPath: string) {
    super(`Metadata already exists: ${folderPath}`)
    this.name = "MetadataAlreadyExistsError"
    this.folderPath = folderPath
  }
}

export class MetadataValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "MetadataValidationError"
  }
}
