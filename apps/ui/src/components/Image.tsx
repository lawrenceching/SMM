import React, { useState, useEffect } from 'react'
import { useImage } from '../hooks/useImage'

interface ImageProps {
  /**
   * Can be HTTP URI, local file URI (file://), or base64 encoded data URL
   */
  url?: string
  /**
   * Base64 encoded image data URL to use as fallback when url cannot be loaded
   */
  placeholder?: string
  /**
   * Alt text for the image
   */
  alt?: string
  /**
   * CSS class name for the image
   */
  className?: string
  /**
   * Error handler callback
   */
  onError?: () => void
}

const Image: React.FC<ImageProps> = ({
  url,
  placeholder,
  alt = '',
  className = '',
  onError
}) => {
  const imageData = useImage(url, placeholder)
  const [hasError, setHasError] = useState(false)

  // Reset error state when imageData changes
  useEffect(() => {
    setHasError(false)
  }, [imageData])

  const handleError = () => {
    setHasError(true)
    onError?.()
  }

  // If there's an error, show placeholder or nothing
  if (hasError && placeholder) {
    return <img src={placeholder} alt={alt} className={className} />
  }

  // If no image data available, show placeholder or nothing
  if (!imageData) {
    if (placeholder) {
      return <img src={placeholder} alt={alt} className={className} />
    }
    return null
  }

  return (
    <img
      src={imageData}
      alt={alt}
      className={className}
      onError={handleError}
    />
  )
}

export default Image
