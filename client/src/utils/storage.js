/**
 * @fileoverview Utility functions for file storage operations.
 * This file provides functions to upload files to R2 storage and serve images
 * from R2 storage for client-side file management.
 * 
 * @module utils/storage
 * @author Cameron Grenier
 * @version 2025-03-26
 */

/**
 * Uploads a file to an R2 storage bucket
 * 
 * @param {Object} env - Environment containing R2_BUCKET binding
 * @param {File} file - The file to upload
 * @param {string} path - The path where the file should be stored in the bucket
 * @throws {Error} If R2_BUCKET binding is missing
 * @returns {Promise<string>} URL path to the uploaded file
 */
export async function uploadFileToR2(env, file, path) {
  if (!env.R2_BUCKET) {
    throw new Error("Missing R2_BUCKET binding");
  }
  const buffer = await file.arrayBuffer();
  const contentType = file.type || 'application/octet-stream';
  await env.R2_BUCKET.put(path, buffer, { httpMetadata: { contentType } });
  return `/images/${path}`;
}

/**
 * Serves an image from Cloudflare R2 storage bucket
 * 
 * @async
 * @param {Object} env - Environment object containing the R2 bucket reference
 * @param {string} imagePath - Path to the image in the R2 bucket
 * @param {Object} corsHeaders - CORS headers to include in the response
 * @returns {Response} - Returns a Response object with the image content or a 404 error
 * 
 * @description
 * This function attempts to fetch an image from R2 storage using the provided path.
 * If the image is not found and the path contains subdirectories, it tries to find 
 * the image at the root level. The function determines the appropriate content type
 * based on the file extension and returns the image with proper headers including
 * CORS support and caching directives.
 * 
 * @example
 * // Assuming env.R2_BUCKET is properly initialized
 * const corsHeaders = {
 *   "Access-Control-Allow-Origin": "*"
 * };
 * const response = await serveImageFromR2(env, "images/photo.jpg", corsHeaders);
 */
export async function serveImageFromR2(env, imagePath, corsHeaders) {
  let object = await env.R2_BUCKET.get(imagePath);
  if (object === null && imagePath.includes('/')) {
    const parts = imagePath.split('/');
    object = await env.R2_BUCKET.get(parts.pop());
  }
  if (object === null) {
    return new Response("Image not found", { status: 404, headers: corsHeaders });
  }
  const extension = imagePath.split('.').pop().toLowerCase();
  const contentTypes = {
    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
    'gif': 'image/gif', 'svg': 'image/svg+xml', 'webp': 'image/webp',
    'bmp': 'image/bmp', 'ico': 'image/x-icon'
  };
  const contentType = contentTypes[extension] || 'application/octet-stream';
  return new Response(object.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*"
    }
  });
}