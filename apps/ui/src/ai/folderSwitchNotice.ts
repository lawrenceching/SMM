/** English notice for the AI model when the UI selected media folder path changes. */
export function folderSwitchNotice(currentPath: string): string {
  if (currentPath === "") {
    return "The user cleared the selected media folder in the app (no folder is selected).";
  }
  return `The user switched the selected media folder in the app to: ${currentPath}`;
}
