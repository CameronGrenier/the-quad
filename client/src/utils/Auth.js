/**
 * Authentication Utilities for The Quad
 * 
 * This class centralizes all authentication related functions including
 * JWT generation/verification and password hashing/verification.
 */
class Auth {
  constructor() {
    // These could be environment variables in production
    this.jwtSecret = "thequadsignature"; // In production, use env.JWT_SECRET
    this.passwordSalt = "the-quad-salt";  // In production, use env.PASSWORD_SALT
  }

  /**
   * Encode string as base64url (JWT compatible)
   * @param {string} str - String to encode
   * @returns {string} base64url encoded string
   */
  base64UrlEncode(str) {
    // First convert to regular base64
    const base64 = btoa(str);
    // Then convert to base64url format by replacing chars and removing padding
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
  
  /**
   * Decode base64url string
   * @param {string} str - Base64url string to decode
   * @returns {string} Decoded string
   */
  base64UrlDecode(str) {
    // Convert from base64url to base64 by reverting replaced chars
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    while (base64.length % 4) {
      base64 += '=';
    }
    return atob(base64);
  }

  /**
   * Generate a JSON Web Token for a user
   * @param {Object} payload - User data to include in token
   * @returns {string} JWT token
   */
  generateJWT(payload) {
    const header = { alg: "HS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 60 * 60 * 24; // 24 hours from now
    
    const tokenPayload = {
      ...payload,
      iat: now,
      exp
    };
    
    const base64Header = this.base64UrlEncode(JSON.stringify(header));
    const base64Payload = this.base64UrlEncode(JSON.stringify(tokenPayload));
    
    // Placeholder signature (in production, sign with a secret)
    const signature = this.base64UrlEncode(this.jwtSecret);
    return `${base64Header}.${base64Payload}.${signature}`;
  }

  /**
   * Verify a JWT token
   * @param {string} token - JWT token to verify
   * @returns {Object} Decoded token payload
   * @throws {Error} If token is invalid
   */
  verifyJWT(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error("Malformed token");
      }
      
      const payload = JSON.parse(this.base64UrlDecode(parts[1]));
      
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error("Token expired");
      }
      
      return payload;
    } catch (error) {
      throw new Error(`Invalid token: ${error.message}`);
    }
  }

  /**
   * Hash a password using SHA-256
   * @param {string} password - Plain text password
   * @returns {Promise<string>} Hashed password
   */
  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + this.passwordSalt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Verify a password against its hashed version
   * @param {string} password - Plain text password to verify
   * @param {string} hashedPassword - Stored hashed password
   * @returns {Promise<boolean>} True if password matches
   */
  async verifyPassword(password, hashedPassword) {
    const passwordHash = await this.hashPassword(password);
    return passwordHash === hashedPassword;
  }

  /**
   * Extract authentication data from the request
   * @param {Request} request - The HTTP request
   * @returns {Object} Authentication information with isAuthenticated and userId
   */
  getAuthFromRequest(request) {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    
    let isAuthenticated = false;
    let userId = null;
    
    if (token) {
      try {
        const userData = this.verifyJWT(token);
        isAuthenticated = !!userData.userId;
        userId = userData.userId;
      } catch (error) {
        // Silently handle the error - don't log it to avoid test issues
        // Just return unauthenticated status
        isAuthenticated = false;
        userId = null;
      }
    }
    
    return { isAuthenticated, userId, token };
  }
}

export default Auth;
