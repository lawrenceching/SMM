export function associatedFilesQueryKey(folderPath: string) {
  return ["associatedFiles", folderPath] as const
}
