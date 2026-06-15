import { Path } from '../path'
import type { IsFolderExistOutput } from '../types/ai-tools/isFolderExist'
import {
  IS_FOLDER_EXIST_INVALID_PATH,
  IS_FOLDER_EXIST_NOT_DIRECTORY,
  IS_FOLDER_EXIST_NOT_FOUND,
} from '../types/ai-tools/isFolderExist'

export function isFolderExistInvalidPath(): IsFolderExistOutput {
  return {
    exists: false,
    path: '',
    reason: IS_FOLDER_EXIST_INVALID_PATH,
  }
}

export function isFolderExistSucceeded(path: string): IsFolderExistOutput {
  return {
    exists: true,
    path: Path.toPlatformPath(path),
  }
}

export function isFolderExistNotDirectory(path: string): IsFolderExistOutput {
  const platformPath = Path.toPlatformPath(path)
  return {
    exists: false,
    path: platformPath,
    reason: IS_FOLDER_EXIST_NOT_DIRECTORY,
  }
}

export function isFolderExistNotFound(path: string): IsFolderExistOutput {
  return {
    exists: false,
    path: Path.toPlatformPath(path),
    reason: IS_FOLDER_EXIST_NOT_FOUND,
  }
}

export function isFolderExistCheckFailed(
  path: string,
  message: string,
): IsFolderExistOutput {
  return {
    exists: false,
    path: Path.toPlatformPath(path),
    reason: `Error checking folder existence: ${message}`,
  }
}
