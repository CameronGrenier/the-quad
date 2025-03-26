/*
 -------------------------------------------------------
 File:     Utils.js
 About:    Utility functions for the client side 
 Author:   Humayoyun Khan
 Version:  2025-03-02
 -------------------------------------------------------
 */

/*
 * Utility class for the client side
 */
export class Utils {
    /*
    -------------------------------------------------------
    * Function to fetch events from the frontend
    * @param request - the request object
    - Parses the request object to get data from various front end forms
    - Sends the data to the backend
    * @returns the FormData object
    -------------------------------------------------------
    */
    static async parseFormData(request) {
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
  
    /*
    -------------------------------------------------------
    * Function to generate a JSON Web Token (JWT)
    * @param payload - the payload object to include in the JWT
    - Generates a JWT with a header, payload, and signature
    * @returns the JWT as a string
    -------------------------------------------------------
    */
    static generateJWT(payload) {
      const header = { alg: "HS256", typ: "JWT" };
      const now = Math.floor(Date.now() / 1000);
      const jwtPayload = { ...payload, iat: now, exp: now + (60 * 60 * 24) };
      const base64Header = btoa(JSON.stringify(header));
      const base64Payload = btoa(JSON.stringify(jwtPayload));
      // Placeholder signature (in production, sign with a secret)
      const signature = btoa("thequadsignature");
      return `${base64Header}.${base64Payload}.${signature}`;
    }
  
    /*
    -------------------------------------------------------
    * Function to hash a password using SHA-256
    * @param password - the password to hash
    - Hashes the password with a salt
    * @returns the hashed password as a string
    -------------------------------------------------------
    */
    static async hashPassword(password) {
      const encoder = new TextEncoder();
      const data = encoder.encode(password + "the-quad-salt");
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
  
    /*
    -------------------------------------------------------
    * Function to verify a password against a hashed password
    * @param password - the password to verify
    * @param hashedPassword - the hashed password to compare against
    - Verifies if the provided password matches the hashed password
    * @returns true if the passwords match, false otherwise
    -------------------------------------------------------
    */
    static async verifyPassword(password, hashedPassword) {
      const passwordHash = await Utils.hashPassword(password);
      return passwordHash === hashedPassword;
    }
  
    /*
    -------------------------------------------------------
    * Function to verify a JSON Web Token (JWT)
    * @param token - the JWT to verify
    - Verifies the JWT and checks its expiration
    * @returns the payload of the JWT if valid
    * @throws an error if the token is invalid or expired
    -------------------------------------------------------
    */
    static verifyJWT(token) {
      try {
        const parts = token.split('.');
        if (parts.length !== 3) throw new Error('Invalid token format');
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000))
          throw new Error('Token has expired');
        return payload;
      } catch (error) {
        throw new Error(`Invalid token: ${error.message}`);
      }
    }
  
    /*
    -------------------------------------------------------
    * Function to upload a file to Cloudflare R2 storage
    * @param env - the environment object containing the R2_BUCKET binding
    * @param file - the file to upload
    * @param path - the path to store the file in R2
    - Uploads the file to Cloudflare R2 storage
    * @returns the URL of the uploaded file
    -------------------------------------------------------
    */
    static async uploadFileToR2(env, file, path) {
      if (!env.R2_BUCKET) {
        throw new Error("Missing R2_BUCKET binding");
      }
      const buffer = await file.arrayBuffer();
      const contentType = file.type || 'application/octet-stream';
      await env.R2_BUCKET.put(path, buffer, { httpMetadata: { contentType } });
      return `/images/${path}`;
    }
  
    /*
    -------------------------------------------------------
    * Function to serve an image from Cloudflare R2 storage
    * @param env - the environment object containing the R2_BUCKET binding
    * @param imagePath - the path of the image in R2
    * @param corsHeaders - the CORS headers to include in the response
    - Serves the image from Cloudflare R2 storage
    * @returns a Response object containing the image
    -------------------------------------------------------
    */
    static async serveImageFromR2(env, imagePath, corsHeaders) {
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
  }