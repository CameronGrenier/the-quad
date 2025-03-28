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
 * @param {string} [secret] - The secret key used for signing (from env in Worker context)
 * @returns {Promise<string>} A JWT string in the format header.payload.signature
 */
export async function generateJWT(payload, secret) {
    const header = { alg: "HS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const jwtPayload = { ...payload, iat: now, exp: now + (60 * 60 * 24) };
    
    const base64Header = btoa(JSON.stringify(header));
    const base64Payload = btoa(JSON.stringify(jwtPayload));
    
    // Create signature with the secret
    const encoder = new TextEncoder();
    const data = encoder.encode(`${base64Header}.${base64Payload}`);
    
    // Use the provided secret or fallback to default secret
    const jwtSecret = secret || "4ce3238e21b48e1c8b056561365ff037dbdcf0664587d3408a7196d772e29475";
    
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(jwtSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    
    const signature = await crypto.subtle.sign("HMAC", key, data);
    const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)));
    
    return `${base64Header}.${base64Payload}.${base64Signature}`;
}

/**
 * Verifies a JSON Web Token (JWT) by parsing and validating its payload.
 * 
 * @param {string} token - The JWT string to verify
 * @param {string} [secret] - The secret key used for signing (from env in Worker context)
 * @returns {Promise<Object>} The decoded payload if the token is valid
 * @throws {Error} If the token format is invalid, the token has expired, or any other validation error occurs
 */
export async function verifyJWT(token, secret) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) throw new Error('Invalid token format');
        
        const [base64Header, base64Payload, base64Signature] = parts;
        const payload = JSON.parse(atob(base64Payload));
        
        // Check expiration
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000))
            throw new Error('Token has expired');
            
        // Verify signature
        const encoder = new TextEncoder();
        const data = encoder.encode(`${base64Header}.${base64Payload}`);
        
        // Use the provided secret or fallback to default secret
        const jwtSecret = secret || "4ce3238e21b48e1c8b056561365ff037dbdcf0664587d3408a7196d772e29475";
        
        const key = await crypto.subtle.importKey(
            "raw",
            encoder.encode(jwtSecret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["verify"]
        );
        
        const signatureArray = new Uint8Array(
            atob(base64Signature).split('').map(c => c.charCodeAt(0))
        );
        
        const isValidSignature = await crypto.subtle.verify(
            "HMAC",
            key,
            signatureArray,
            data
        );
        
        if (!isValidSignature) throw new Error('Invalid signature');
        
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
    const hashedInput = await hashPassword(password);
    return hashedInput === hashedPassword;
}