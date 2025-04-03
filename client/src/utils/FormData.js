/**
 * Form Data Utilities for The Quad
 * 
 * This utility encapsulates form data parsing and handling functions
 * to make the codebase more maintainable.
 */
class FormDataUtil {
  /**
   * Parse form data from a request
   * @param {Request} request - The request object containing form data
   * @returns {Promise<FormData>} Parsed form data
   */
  async parseFormData(request) {
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      // Handle multipart/form-data (file uploads)
      return await request.formData();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      // Handle URL-encoded form data
      return await request.formData();
    } else if (contentType.includes('application/json')) {
      // Handle JSON body and convert to FormData
      const data = await request.json();
      const formData = new FormData();
      
      // Convert JSON object to FormData
      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          formData.append(key, data[key]);
        }
      }
      
      return formData;
    }
    
    // Return empty FormData if we can't determine the type
    return new FormData();
  }
  
  /**
   * Extract values from form data with type conversion
   * @param {FormData} formData - The form data object
   * @param {string} key - Key to extract
   * @param {string} type - Type to convert to ('string', 'number', 'boolean')
   * @param {any} defaultValue - Default value if not found
   * @returns {any} Extracted and converted value
   */
  getFormValue(formData, key, type = 'string', defaultValue = null) {
    const value = formData.get(key);
    
    if (value === null) {
      return defaultValue;
    }
    
    switch (type) {
      case 'number':
        return Number(value);
      case 'boolean':
        return value === 'true' || value === '1' || value === true;
      default:
        return value;
    }
  }
}

// Create a singleton instance
const formDataUtil = new FormDataUtil();

export default formDataUtil;