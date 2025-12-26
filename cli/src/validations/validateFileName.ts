import sanitizeFileName from 'sanitize-filename';
export function validateFileName(fileName: string): boolean {
  if (!fileName || fileName.trim().length === 0) {
    return false;
  }
  const sanitizedFileName = sanitizeFileName(fileName);
  return sanitizedFileName === fileName;
}