/**
 * @fileoverview Utility functions for authentication and security operations.
 * This file provides functions to generate and verify JWTs, hash passwords,
 * and perform password verification for client-side security operations.
 * 
 * @module utils/auth
 * @author Cameron Grenier
 * @version 2025-03-26
 */


/**
 * Generates a JSON Web Token (JWT) using the provided payload
 * 
 * @param {Object} payload - The data to be included in the JWT
 * @returns {string} A JWT string in the format header.payload.signature
 * 
 * @remarks
 * This implementation uses a placeholder signature for demonstration purposes.
 * In production, the token should be properly signed with a secret key.
 * The generated token includes:
 * - 'iat' (issued at) timestamp
 * - 'exp' (expiration) timestamp set to 24 hours after creation
 */
export function generateJWT(payload) {
    const header = { alg: "HS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const jwtPayload = { ...payload, iat: now, exp: now + (60 * 60 * 24) };
    const base64Header = btoa(JSON.stringify(header));
    const base64Payload = btoa(JSON.stringify(jwtPayload));
    // Placeholder signature (in production, sign with a secret)
    const signature = btoa("thequadsignature");
    return `${base64Header}.${base64Payload}.${signature}`;
}

/**
 * Verifies a JSON Web Token (JWT) by parsing and validating its payload.
 * 
 * @param {string} token - The JWT string to verify
 * @returns {Object} The decoded payload if the token is valid
 * @throws {Error} If the token format is invalid, the token has expired, or any other validation error occurs
 */
export function verifyJWT(token) {
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

/**
 * Hashes a password using SHA-256 algorithm with a predefined salt.
 * 
 * @param {string} password - The plain text password to be hashed.
 * @returns {Promise<string>} A promise that resolves to the hexadecimal string representation of the hashed password.
 * @async
 * @example
 * const hashedPassword = await hashPassword('userPassword');
 * // Returns: "a1b2c3d4e5f6..."
 */
export async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + "the-quad-salt");
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Verifies if a provided password matches a hashed password.
 * 
 * @async
 * @function verifyPassword
 * @param {string} password - The password to verify.
 * @param {string} hashedPassword - The hashed password to compare against.
 * @returns {Promise<boolean>} A promise that resolves to true if the password matches, false otherwise.
 */
export async function verifyPassword(password, hashedPassword) {
    const passwordHash = await Utils.hashPassword(password);
    return passwordHash === hashedPassword;
}