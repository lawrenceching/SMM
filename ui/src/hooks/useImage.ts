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
      
      // Download the image using the /api/image endpoint
      fetch(`/api/image?url=${encodeURIComponent(normalizedUrl)}`)
        .then(async (resp) => {
          if (!resp.ok) {
            throw new Error(`Failed to download image: ${resp.statusText}`)
          }
          
          // Get the image as blob
          const blob = await resp.blob()
          
          // Convert blob to base64 data URL
          const reader = new FileReader()
          reader.onloadend = () => {
            const base64data = reader.result as string
            setImageData(base64data)
          }
          reader.onerror = () => {
            console.error('[useImage] Failed to convert image to base64')
            setImageData(placeholder)
          }
          reader.readAsDataURL(blob)
        })
        .catch((error) => {
          console.error(`[useImage] Error downloading image from ${normalizedUrl}:`, error)
          setImageData(placeholder)
        })
      
      return
    }

   
  }, [url, placeholder])

  return imageData
}
