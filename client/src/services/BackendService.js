/**
 * BackendService - Handles database and R2 storage interactions
 * 
 * This service centralizes all data operations for The Quad application,
 * making the codebase more maintainable and modular.
 */
class BackendService {
  constructor(env) {
    this.env = env;
    this.db = env.D1_DB;
    this.r2Bucket = env.R2_BUCKET;
  }

  /**
   * Uploads a file to R2 storage with a sanitized path
   * @param {File} file - The file to upload
   * @param {string} path - The path/filename for the file in storage
   * @returns {Promise<string>} URL to access the uploaded file
   */
  async uploadFile(file, path) {
    if (!this.r2Bucket) {
      throw new Error("Missing R2_BUCKET binding");
    }
    
    // Sanitize the path to handle special characters
    // Extract the base path and filename
    let basePath = '';
    let fileName = path;
    
    if (path.includes('/')) {
      const lastSlashIndex = path.lastIndexOf('/');
      basePath = path.substring(0, lastSlashIndex + 1);
      fileName = path.substring(lastSlashIndex + 1);
    }
    
    // Sanitize only the filename portion
    const sanitizedFileName = this.sanitizeFileName(fileName);
    const sanitizedPath = basePath + sanitizedFileName;
    
    // Upload the file with the sanitized path
    const buffer = await file.arrayBuffer();
    const contentType = file.type || 'application/octet-stream';
    await this.r2Bucket.put(sanitizedPath, buffer, { httpMetadata: { contentType } });
    return `/images/${sanitizedPath}`;
  }

  /**
   * Serves an image from R2 storage
   * @param {string} imagePath - Path to the image in R2 storage
   * @param {Object} corsHeaders - CORS headers to include in response
   * @returns {Promise<Response>} Response with image content
   */
  async serveImage(imagePath, corsHeaders) {
    let object = await this.r2Bucket.get(imagePath);
    if (object === null && imagePath.includes('/')) {
      const parts = imagePath.split('/');
      object = await this.r2Bucket.get(parts.pop());
    }
    if (object === null) {
      return new Response("Image not found", { status: 404, headers: corsHeaders });
    }
    const extension = imagePath.split('.').pop().toLowerCase();
    const contentTypes = {
      'jpg':'image/jpeg','jpeg':'image/jpeg','png':'image/png',
      'gif':'image/gif','svg':'image/svg+xml','webp':'image/webp',
      'bmp':'image/bmp','ico':'image/x-icon'
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

  /**
   * Sanitizes a filename for safe storage
   * @param {string} name - Original filename
   * @returns {string} Sanitized filename
   */
  sanitizeFileName(name) {
    // Replace spaces with underscores
    let sanitized = name.replace(/\s+/g, '_');
    
    // Remove apostrophes, quotes and other problematic characters
    sanitized = sanitized.replace(/['"&?#%:;+=@<>{}()|/\\^$!,*]/g, '');
    
    // Replace accented characters with their non-accented equivalents
    sanitized = sanitized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Ensure no double underscores
    sanitized = sanitized.replace(/_+/g, '_');
    
    return sanitized;
  }

  /**
   * Execute a database query with prepared statements
   * @param {string} query - SQL query with placeholders
   * @param {Array} params - Parameters to bind to the query
   * @returns {Promise<Object>} Query results
   */
  async query(query, params = []) {
    const statement = this.db.prepare(query);
    return statement.bind(...params).run();
  }

  /**
   * Fetch a single row from the database
   * @param {string} query - SQL query with placeholders
   * @param {Array} params - Parameters to bind to the query
   * @returns {Promise<Object>} First row of results
   */
  async queryFirst(query, params = []) {
    const statement = this.db.prepare(query);
    return statement.bind(...params).first();
  }

  /**
   * Fetch multiple rows from the database
   * @param {string} query - SQL query with placeholders
   * @param {Array} params - Parameters to bind to the query
   * @returns {Promise<Object>} All query results
   */
  async queryAll(query, params = []) {
    const statement = this.db.prepare(query);
    return statement.bind(...params).all();
  }

  /**
   * Execute multiple database statements in a batch (similar to transactions)
   * @param {Array} statements - Array of prepared statements
   * @returns {Promise<Object>} Batch execution result
   */
  async executeBatch(statements) {
    return this.db.batch(statements);
  }

  /**
   * Prepare multiple statements for batch execution
   * @param {Array} queryParamsPairs - Array of [query, params] pairs
   * @returns {Array} Array of prepared statements ready for batch execution
   */
  prepareBatch(queryParamsPairs) {
    return queryParamsPairs.map(([query, params]) => {
      return this.db.prepare(query).bind(...params);
    });
  }
}

export default BackendService;