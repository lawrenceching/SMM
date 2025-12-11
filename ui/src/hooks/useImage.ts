import { useState, useEffect } from 'react'

/**
 * Hook to load image data from various sources
 * @param url - Can be HTTP URI, local file URI (file://), or base64 encoded data URL
 * @param placeholder - Base64 encoded image data URL to use as fallback
 * @returns Base64 encoded image data URL
 */
export function useImage(url?: string, placeholder?: string): string | undefined {
  const [imageData, setImageData] = useState<string | undefined>(undefined)

  useEffect(() => {
    // If no URL provided, use placeholder or undefined
    if (!url) {
      setImageData(placeholder)
      return
    }

    // Check if URL is already a base64 encoded data URL
    if (url.startsWith('data:')) {
      setImageData(url)
      return
    }

    // Check if URL is a local file URI (file://)
    if (url.startsWith('file://')) {
      // Remove file:// prefix to get the local path
      // Handle both file:/// and file:// formats
      let localPath = url.replace(/^file:\/\//, '')
      // If the path starts with /, it might be a Windows path like /C:/path
      // On Windows, we want C:/path instead of /C:/path
      if (localPath.match(/^\/[A-Za-z]:/)) {
        localPath = localPath.substring(1)
      }
      console.log(`[useImage] loading base64 encoded image from local file: ${localPath}`)
      window.api
        .getBase64EncodedImage(localPath)
        .then((resp) => {
          if (resp.data !== undefined && resp.data !== null) {
            setImageData(resp.data)
          } else {
            setImageData(placeholder)
          }
        })
        .catch(() => {
          setImageData(placeholder)
        })
      return
    }

    // Check if URL is an HTTP/HTTPS URI or protocol-relative (//)
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
      // Normalize protocol-relative URLs
      let normalizedUrl = url
      if (url.startsWith('//')) {
        normalizedUrl = `https:${url}`
      }

      console.log(`[useImage] downloading image from HTTP/HTTPS URL: ${normalizedUrl}`)
      
      // Download image to temp file, then get base64 encoded data
      window.api
        .downloadImageToTemp(normalizedUrl)
        .then((downloadResp) => {
          if (downloadResp.error) {
            console.error(`[useImage] Failed to download image: ${downloadResp.error}`)
            setImageData(placeholder)
            return
          }
          
          if (!downloadResp.data) {
            setImageData(placeholder)
            return
          }

          // Get base64 encoded image from temp file
          return window.api.getBase64EncodedImage(downloadResp.data)
        })
        .then((base64Resp) => {
          if (base64Resp && base64Resp.data !== undefined && base64Resp.data !== null) {
            setImageData(base64Resp.data)
          } else {
            setImageData(placeholder)
          }
        })
        .catch((error) => {
          console.error(`[useImage] Error processing HTTP/HTTPS image:`, error)
          setImageData(placeholder)
        })
      return
    }

    // For other cases (like relative paths), try to treat as local file
    console.log(`[useImage] loading base64 encoded image from URL: ${url}`)
    window.api
      .getBase64EncodedImage(url)
      .then((resp) => {
        if (resp.data !== undefined && resp.data !== null) {
          setImageData(resp.data)
        } else {
          setImageData(placeholder)
        }
      })
      .catch(() => {
        setImageData(placeholder)
      })
  }, [url, placeholder])

  return imageData
}
