import { z } from 'zod';
import path from 'path';
import type { ReadImageRequestBody, ReadImageResponseBody } from '@core/types';

const readImageRequestSchema = z.object({
  path: z.string().min(1, 'Path is required'),
});

/**
 * Valid image file extensions
 */
const VALID_IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.bmp',
  '.ico',
  '.tiff',
  '.tif',
];

/**
 * Check if file extension is a valid image extension
 */
function isValidImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return VALID_IMAGE_EXTENSIONS.includes(ext);
}

/**
 * Get MIME type from file extension
 */
function getImageMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
    '.ico': 'image/x-icon',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
  };
  
  return mimeTypes[ext] || 'image/jpeg'; // Default to jpeg if unknown
}

export async function handleReadImage(body: ReadImageRequestBody): Promise<ReadImageResponseBody> {
  try {
    // Validate request body
    const validationResult = readImageRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return {
        error: `Validation failed: ${validationResult.error.issues.map(i => i.message).join(', ')}`,
      };
    }

    const { path: filePath } = validationResult.data;
    
    // Resolve to absolute path
    const resolvedPath = path.resolve(filePath);
    
    // Validate that the file is an image file
    if (!isValidImageFile(resolvedPath)) {
      return {
        error: `File is not a valid image file. Supported formats: ${VALID_IMAGE_EXTENSIONS.join(', ')}`,
      };
    }

    // Read image file using Bun's file API
    try {
      const file = Bun.file(resolvedPath);
      const exists = await file.exists();
      
      if (!exists) {
        return {
          error: `File not found: ${filePath}`,
        };
      }

      // Read file as array buffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Convert to base64
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      
      // Get MIME type from file extension
      const mimeType = getImageMimeType(resolvedPath);
      
      // Return in data URL format: "data:image/xxx;base64,xxxxx"
      const dataUrl = `data:${mimeType};base64,${base64}`;
      
      return {
        data: dataUrl,
      };
    } catch (error) {
      return {
        error: `Failed to read image file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  } catch (error) {
    return {
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

