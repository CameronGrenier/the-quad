import { generateJWT, hashPassword, verifyPassword, verifyJWT } from '../../client/src/utils/auth.js';

describe('Auth Utilities', () => {
  describe('JWT Functions', () => {
    const payload = { userId: 1, email: 'test@example.com', username: 'testuser' };
    
    test('generateJWT should create a valid JWT token', () => {
      const token = generateJWT(payload);
      
      // Check token format (header.payload.signature)
      expect(token.split('.')).toHaveLength(3);
    });
    
    test('verifyJWT should correctly decode a valid token', () => {
      const token = generateJWT(payload);
      const decoded = verifyJWT(token);
      
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.username).toBe(payload.username);
      expect(decoded.iat).toBeDefined(); // Check issued at timestamp
      expect(decoded.exp).toBeDefined(); // Check expiration timestamp
    });
    
    test('verifyJWT should throw on invalid token format', () => {
      expect(() => {
        verifyJWT('invalid-token');
      }).toThrow('Invalid token: Invalid token format');
    });
  });
  
  describe('Password Functions', () => {
    test('hashPassword should hash a password consistently', async () => {
      const password = 'secure123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(password);
      expect(hash1.length).toBeGreaterThan(0);
    });
    
    test('verifyPassword should return true for matching password', async () => {
      const password = 'secure123';
      const hashedPassword = await hashPassword(password);
      
      const result = await verifyPassword(password, hashedPassword);
      expect(result).toBe(true);
    });
    
    test('verifyPassword should return false for non-matching password', async () => {
      const password = 'secure123';
      const wrongPassword = 'wrong123';
      const hashedPassword = await hashPassword(password);
      
      const result = await verifyPassword(wrongPassword, hashedPassword);
      expect(result).toBe(false);
    });
  });
});