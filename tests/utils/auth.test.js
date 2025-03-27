import { jest } from '@jest/globals';
import { generateJWT, verifyJWT, hashPassword, verifyPassword } from '../../client/src/utils/auth.js';

// Mock the globals that might not be available in Node.js test environment
global.btoa = (str) => Buffer.from(str).toString('base64');
global.atob = (str) => Buffer.from(str, 'base64').toString();

// Mock crypto for consistent test results
const mockDigest = jest.fn();
global.crypto = {
  subtle: {
    digest: mockDigest
  }
};

describe('Auth Utilities', () => {
  beforeEach(() => {
    // Reset the mock before each test
    mockDigest.mockReset();
    
    // Set up a default mock implementation that returns a consistent hash
    mockDigest.mockImplementation(() => {
      return Promise.resolve(
        new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])
      );
    });
  });

  describe('generateJWT', () => {
    test('should return a valid JWT token', () => {
      const payload = { id: 1, username: 'testuser' };
      const token = generateJWT(payload);
      expect(token).toBeDefined();
    });

    test('should create token with three parts separated by dots', () => {
      const payload = { id: 1, username: 'testuser' };
      const token = generateJWT(payload);
      const parts = token.split('.');
      expect(parts.length).toBe(3);
    });

    test('should include payload data in the token', () => {
      const payload = { id: 1, username: 'testuser' };
      const token = generateJWT(payload);
      const parts = token.split('.');
      const decodedPayload = JSON.parse(atob(parts[1]));
      
      expect(decodedPayload).toHaveProperty('id', 1);
      expect(decodedPayload).toHaveProperty('username', 'testuser');
    });

    test('should include expiration and issued at timestamps', () => {
      const payload = { id: 1 };
      const token = generateJWT(payload);
      const parts = token.split('.');
      const decodedPayload = JSON.parse(atob(parts[1]));
      
      expect(decodedPayload).toHaveProperty('iat');
      expect(decodedPayload).toHaveProperty('exp');
      expect(decodedPayload.exp).toBeGreaterThan(decodedPayload.iat);
    });
  });

  describe('verifyJWT', () => {
    test('should verify and return payload from valid token', () => {
      const originalPayload = { id: 1, username: 'testuser' };
      const token = generateJWT(originalPayload);
      const payload = verifyJWT(token);
      
      expect(payload.id).toBe(originalPayload.id);
      expect(payload.username).toBe(originalPayload.username);
    });
    
    test('should throw error for invalid token format', () => {
      expect(() => {
        verifyJWT('invalid.token');
      }).toThrow('Invalid token: Invalid token format');
    });
    
    test('should throw error for expired token', () => {
      // Create a token that's already expired
      const header = { alg: "HS256", typ: "JWT" };
      const now = Math.floor(Date.now() / 1000);
      const jwtPayload = { 
        id: 1, username: 'testuser', 
        iat: now - 100, exp: now - 10 // Expired 10 seconds ago
      }; 
      const base64Header = btoa(JSON.stringify(header));
      const base64Payload = btoa(JSON.stringify(jwtPayload));
      const signature = btoa("thequadsignature");
      const expiredToken = `${base64Header}.${base64Payload}.${signature}`;
      
      expect(() => {
        verifyJWT(expiredToken);
      }).toThrow('Invalid token: Token has expired');
    });
  });

  describe('hashPassword', () => {
    test('should call crypto.subtle.digest with correct parameters', async () => {
      await hashPassword('testpassword');
      
      expect(mockDigest).toHaveBeenCalledTimes(1);
      expect(mockDigest.mock.calls[0][0]).toBe('SHA-256');
      // The second parameter is the encoded password + salt
    });
    
    test('should return hexadecimal string representation', async () => {
      // Our mock returns a fixed byte array [1, 2, 3, ...]
      const result = await hashPassword('password');
      
      // Expected: each byte is converted to 2-digit hex
      expect(result).toBe('0102030405060708090a0b0c0d0e0f10');
    });

    test('should produce consistent hash for same input', async () => {
      // Make the mock return different values for different calls
      mockDigest
        .mockImplementationOnce(() => Promise.resolve(new Uint8Array([1, 2, 3])))
        .mockImplementationOnce(() => Promise.resolve(new Uint8Array([1, 2, 3])));
      
      const hash1 = await hashPassword('same-password');
      const hash2 = await hashPassword('same-password');
      
      expect(hash1).toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    test('should return true when password matches hash', async () => {
      // First fix the verifyPassword function in auth.js to use hashPassword directly
      
      // Setup mockDigest to return the same value for both hashPassword calls
      mockDigest.mockResolvedValue(new Uint8Array([1, 2, 3]));
      
      const hash = await hashPassword('correct-password');
      const result = await verifyPassword('correct-password', hash);
      
      expect(result).toBe(true);
    });
    
    test('should return false when password does not match hash', async () => {
      // First fix the verifyPassword function in auth.js
      
      // Setup mockDigest to return different values for different inputs
      mockDigest
        .mockImplementationOnce(() => Promise.resolve(new Uint8Array([1, 2, 3])))
        .mockImplementationOnce(() => Promise.resolve(new Uint8Array([4, 5, 6])));
      
      const hash = await hashPassword('correct-password');
      const result = await verifyPassword('wrong-password', hash);
      
      expect(result).toBe(false);
    });
  });
});