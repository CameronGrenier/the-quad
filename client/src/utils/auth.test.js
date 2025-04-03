import Auth from './auth';

// Mock crypto.subtle for testing in Node environment
global.crypto = {
  subtle: {
    digest: jest.fn().mockImplementation((algorithm, data) => {
      // Improved mock implementation that considers the actual content
      const mockHashBuffer = new ArrayBuffer(32);
      const mockHashArray = new Uint8Array(mockHashBuffer);
      
      // Get actual data from the input to make different inputs produce different hashes
      const dataView = new Uint8Array(data);
      let sum = 0;
      for (let i = 0; i < dataView.length; i++) {
        sum += dataView[i];
      }
      
      // Use the sum to create a different hash for different inputs
      for (let i = 0; i < mockHashArray.length; i++) {
        mockHashArray[i] = (sum + i) % 256;
      }
      
      return Promise.resolve(mockHashBuffer);
    })
  }
};

// Mock btoa and atob for testing in Node environment
global.btoa = (str) => Buffer.from(str).toString('base64');
global.atob = (base64) => Buffer.from(base64, 'base64').toString();

// Mock TextEncoder
global.TextEncoder = class TextEncoder {
  encode(input) {
    return Buffer.from(input);
  }
};

describe('Auth', () => {
  let auth;

  beforeEach(() => {
    auth = new Auth();
    jest.spyOn(global.Math, 'floor').mockReturnValue(1000); // Mock time for consistent token generation
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('JWT functionality', () => {
    test('generateJWT should create a valid JWT token', () => {
      const payload = { userId: 123, username: 'testuser' };
      const token = auth.generateJWT(payload);
      
      // Check token structure (now matches JWT standard without padding)
      expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
      
      // Verify parts
      const [header, payload_part, signature] = token.split('.');
      
      // Verify header
      const decodedHeader = JSON.parse(auth.base64UrlDecode(header));
      expect(decodedHeader).toEqual({ alg: 'HS256', typ: 'JWT' });
      
      // Verify payload
      const decodedPayload = JSON.parse(auth.base64UrlDecode(payload_part));
      expect(decodedPayload.userId).toBe(123);
      expect(decodedPayload.username).toBe('testuser');
      expect(decodedPayload.iat).toBe(1000);
      expect(decodedPayload.exp).toBe(1000 + 60 * 60 * 24);
      
      // Verify signature exists
      expect(signature).toBeTruthy();
    });

    test('verifyJWT should validate a correctly formed token', () => {
      const payload = { userId: 123, username: 'testuser' };
      const token = auth.generateJWT(payload);
      
      const result = auth.verifyJWT(token);
      
      expect(result.userId).toBe(payload.userId);
      expect(result.username).toBe(payload.username);
    });

    test('verifyJWT should throw on malformed token', () => {
      // Fix for the error assertion
      try {
        auth.verifyJWT('invalid.token');
        fail('Expected an error but none was thrown');  // This line shouldn't be reached
      } catch (error) {
        expect(error.message).toContain('Invalid token: Malformed token');
      }
    });

    test('verifyJWT should throw on expired token', () => {
      // Create a token that has already expired
      const payload = { userId: 123, exp: 500 }; // expired
      const header = { alg: 'HS256', typ: 'JWT' };
      
      const base64Header = auth.base64UrlEncode(JSON.stringify(header));
      const base64Payload = auth.base64UrlEncode(JSON.stringify(payload));
      const signature = auth.base64UrlEncode(auth.jwtSecret);
      
      const expiredToken = `${base64Header}.${base64Payload}.${signature}`;
      
      // Fix for the error assertion
      try {
        auth.verifyJWT(expiredToken);
        fail('Expected an error but none was thrown');  // This line shouldn't be reached
      } catch (error) {
        expect(error.message).toContain('Invalid token: Token expired');
      }
    });
  });

  // Password tests should now pass with the improved mock
  describe('Password handling', () => {
    test('hashPassword should produce a hash string', async () => {
      const password = 'securepassword';
      const hash = await auth.hashPassword(password);
      
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    test('hashPassword should produce the same hash for the same password', async () => {
      const password = 'securepassword';
      
      const hash1 = await auth.hashPassword(password);
      const hash2 = await auth.hashPassword(password);
      
      expect(hash1).toBe(hash2);
    });

    test('hashPassword should produce different hashes for different passwords', async () => {
      const password1 = 'securepassword1';
      const password2 = 'securepassword2';
      
      const hash1 = await auth.hashPassword(password1);
      const hash2 = await auth.hashPassword(password2);
      
      expect(hash1).not.toBe(hash2);
    });

    test('verifyPassword should return true for matching passwords', async () => {
      const password = 'securepassword';
      const hash = await auth.hashPassword(password);
      
      const result = await auth.verifyPassword(password, hash);
      
      expect(result).toBe(true);
    });

    test('verifyPassword should return false for non-matching passwords', async () => {
      const password = 'securepassword';
      const wrongPassword = 'wrongpassword';
      const hash = await auth.hashPassword(password);
      
      const result = await auth.verifyPassword(wrongPassword, hash);
      
      expect(result).toBe(false);
    });
  });

  test('Auth constructor should set default secret and salt values', () => {
    expect(auth.jwtSecret).toBe('thequadsignature');
    expect(auth.passwordSalt).toBe('the-quad-salt');
  });
  
  // Test the new base64url encoding/decoding methods
  describe('Base64Url encoding', () => {
    test('base64UrlEncode should encode properly without padding', () => {
      const input = 'Hello, World!';
      const encoded = auth.base64UrlEncode(input);
      
      expect(encoded).not.toContain('='); // No padding
      expect(encoded).not.toContain('+'); // No + characters
      expect(encoded).not.toContain('/'); // No / characters
    });
    
    test('base64UrlDecode should decode properly', () => {
      const original = 'Hello, World!';
      const encoded = auth.base64UrlEncode(original);
      const decoded = auth.base64UrlDecode(encoded);
      
      expect(decoded).toBe(original);
    });
  });

  describe('Request authentication', () => {
    test('getAuthFromRequest should extract and verify token from headers', () => {
      const userId = 123;
      const payload = { userId };
      const token = auth.generateJWT(payload);
      
      const mockRequest = {
        headers: {
          get: jest.fn().mockImplementation((header) => {
            if (header === 'Authorization') {
              return `Bearer ${token}`;
            }
            return null;
          })
        }
      };
      
      const authInfo = auth.getAuthFromRequest(mockRequest);
      
      expect(authInfo.isAuthenticated).toBe(true);
      expect(authInfo.userId).toBe(userId);
      expect(authInfo.token).toBe(token);
    });
    
    test('getAuthFromRequest should handle missing token', () => {
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue(null)
        }
      };
      
      const authInfo = auth.getAuthFromRequest(mockRequest);
      
      expect(authInfo.isAuthenticated).toBe(false);
      expect(authInfo.userId).toBeNull();
      expect(authInfo.token).toBeFalsy();
    });
    
    test('getAuthFromRequest should handle invalid token', () => {
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Bearer invalid.token')
        }
      };
      
      const authInfo = auth.getAuthFromRequest(mockRequest);
      
      expect(authInfo.isAuthenticated).toBe(false);
      expect(authInfo.userId).toBeNull();
    });
  });
});