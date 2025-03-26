/**
 * @fileoverview Utility functions for handling form data in client-side operations.
 * This file provides functions to parse and manage form data from different content types,
 * supporting multipart/form-data, url-encoded forms, and JSON payloads.
 * 
 * @module utils/formData
 * @author Cameron Grenier
 * @version 2025-03-26
 */


/**
 * Parses the data from an incoming request based on its content-type header.
 * Supports multipart/form-data, application/x-www-form-urlencoded, and application/json content types.
 * For JSON data, converts it to FormData format.
 * 
 * @param {Request} request - The incoming request object with headers and body
 * @returns {Promise<FormData>} A Promise that resolves to FormData containing the parsed request data
 */
export async function parseFormData(request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data') ||
      contentType.includes('application/x-www-form-urlencoded')) {
    return await request.formData();
  } else if (contentType.includes('application/json')) {
    const json = await request.json();
    const formData = new FormData();
    Object.entries(json).forEach(([key, value]) => {
      formData.append(key, value);
    });
    return formData;
  }
  return new FormData();
}