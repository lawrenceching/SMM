/* eslint-disable @typescript-eslint/no-explicit-any */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { videoFileExtensions, imageFileExtensions } from "@smm/types/mediaFileExtensions"

export { videoFileExtensions, imageFileExtensions }

import { findAssociatedFiles } from "@/lib/associatedFilesUi"

export { findAssociatedFiles }


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const STORAGE_KEY_TRACE_ID = 'traceId';

let runtimeTraceIdCounter = 0; // Fallback if localStorage fails

/**
 * Returns the next trace ID as an integer.
 * The trace ID is persisted in localStorage and increments with each call.
 * If localStorage is unavailable, falls back to a runtime counter.
 * 
 * @returns The next trace ID (starts at 1 for the first call)
 */
export function nextTraceId(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_TRACE_ID);
    const currentId = stored !== null ? parseInt(stored, 10) : 0;
    const nextId = isNaN(currentId) ? 1 : currentId + 1;
    localStorage.setItem(STORAGE_KEY_TRACE_ID, nextId.toString());
    return nextId;
  } catch {
    // Fallback to runtime counter if localStorage fails
    runtimeTraceIdCounter++;
    return runtimeTraceIdCounter;
  }
}

/**
 * Validates that specified fields in an object are not undefined.
 * @param obj The object to validate
 * @param fields The field names to check
 * @throws Error if any of the specified fields are undefined
 */
export function requireFieldsNonUndefined<T extends Record<string, any>>(
  obj: T,
  ...fields: (keyof T)[]
): void {
  const undefinedFields: string[] = []

  for (const field of fields) {
    if (obj[field] === undefined) {
      undefinedFields.push(String(field))
    }
  }

  if (undefinedFields.length > 0) {
    const fieldsList = undefinedFields.join(', ')
    throw new Error(
      `Required fields are undefined: ${fieldsList}. Object: ${JSON.stringify(obj)}`
    )
  }
}