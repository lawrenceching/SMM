import { useState, useEffect } from 'react'

type UrlType = 'data' | 'file' | 'http' | 'https' | 'protocol-relative' | 'unknown'

function getUrlType(url: string): UrlType {
  if (url.startsWith('data:')) return 'data'
  if (url.startsWith('file://')) return 'file'
  if (url.startsWith('http://')) return 'http'
  if (url.startsWith('https://')) return 'https'
  if (url.startsWith('//')) return 'protocol-relative'
  return 'unknown'
}

function normalizeUrl(url: string): string {
  if (url.startsWith('//')) {
    return `https:${url}`
  }
  return url
}

function convertBlobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64data = reader.result as string
      resolve(base64data)
    }
    reader.onerror = () => {
      reject(new Error('Failed to convert blob to base64'))
    }
    reader.readAsDataURL(blob)
  })
}

async function downloadImage(url: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(url, { signal })
  
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`)
  }
  
  return response.blob()
}

/**
 * Hook to load image data from various sources
 * @param url - Can be HTTP URI, local file URI (file://), or base64 encoded data URL
 * @param placeholder - Base64 encoded image data URL to use as fallback
 * @returns Base64 encoded image data URL
 */
export function useImage(url?: string, placeholder?: string): string | undefined {
  const [imageData, setImageData] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!url) {
      setImageData(placeholder)
      return
    }

    const urlType = getUrlType(url)
    const abortController = new AbortController()

    if (urlType === 'data') {
      setImageData(url)
      return
    }

    if (urlType === 'unknown') {
      console.error(`[useImage] Unknown URL type: ${url}`)
      setImageData(placeholder)
      return
    }

    const imageUrl = urlType === 'protocol-relative' ? normalizeUrl(url) : url
    const apiUrl = `/api/image?url=${encodeURIComponent(imageUrl)}`

    downloadImage(apiUrl, abortController.signal)
      .then(async (blob) => {
        const base64data = await convertBlobToBase64(blob)
        setImageData(base64data)
      })
      .catch((error) => {
        console.error(`[useImage] Error downloading image from ${imageUrl}:`, error)
        setImageData(placeholder)
      })

    return () => {
      abortController.abort()
    }
  }, [url, placeholder])

  return imageData
}
