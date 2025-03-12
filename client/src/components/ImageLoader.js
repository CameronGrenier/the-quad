import React, { useState } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'https://the-quad-worker.gren9484.workers.dev';

function ImageLoader({ src, alt, className, style }) {
  const [error, setError] = useState(false);
  
  // Function to convert R2 direct URLs to worker proxy URLs
  const getProxyUrl = (url) => {
    if (!url) return null;
    
    // Return fallback for error state
    if (error) return null;
    
    try {
      // Handle direct R2 URLs
      if (url.includes('r2.cloudflarestorage.com')) {
        // Extract the path part after '/images/'
        const pathMatch = url.match(/\/images\/(.+)$/);
        if (pathMatch && pathMatch[1]) {
          return `${API_URL}/images/${pathMatch[1]}`;
        }
        
        // If URL pattern is different, try this alternate approach
        // Extract everything after the last '/' if there's no '/images/' in the URL
        const parts = url.split('/');
        const filename = parts[parts.length - 1];
        return `${API_URL}/images/thumbnails/${filename}`;
      }
      
      // If it's already a relative path, make sure it goes through our worker
      if (url.startsWith('/')) {
        return `${API_URL}${url}`;
      }
      
      // Otherwise, return as is
      return url;
    } catch (e) {
      console.error("Error processing image URL:", e);
      return null;
    }
  };

  return src ? (
    <img
      src={getProxyUrl(src)}
      alt={alt || 'Image'}
      className={className}
      style={style}
      onError={() => setError(true)}
    />
  ) : null;
}

export default ImageLoader;