import { AccountController } from '../../client/src/controllers/AccountController.js';
import * as authUtils from '../../client/src/utils/auth.js';

describe('AccountController', () => {
  let controller;
  let mockEnv;
  let corsHeaders;
  
  beforeEach(() => {
    corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    };
    
    // Setup mock D1 database
    mockEnv = {
      D1_DB: {
        prepare: jest.fn(() => ({
          bind: jest.fn(() => ({
            first: jest.fn().mockResolvedValue(null),
            all: jest.fn().mockResolvedValue({ results: [] }),
            run: jest.fn().mockResolvedValue({ meta: { last_row_id: 123 } })
          }))
        }))
      }
    };
    
    controller = new AccountController(mockEnv, corsHeaders);
    
    // Mock auth utilities
    jest.spyOn(authUtils, 'hashPassword').mockResolvedValue('hashed_password');
    jest.spyOn(authUtils, 'generateJWT').mockReturnValue('mocked_jwt_token');
    jest.spyOn(authUtils, 'verifyPassword').mockResolvedValue(true);
    jest.spyOn(authUtils, 'verifyJWT').mockReturnValue({ userId: 123, email: 'test@example.com' });
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createAccount', () => {
    test('should create a new account successfully', async () => {
      const mockRequest = {
        json: jest.fn().mockResolvedValue({
          f_name: 'Test',
          l_name: 'User',
          username: 'testuser',
          email: 'test@example.com',
          phone: '1234567890',
          password: 'password123'
        })
      };
      
      const response = await controller.createAccount(mockRequest);
      const responseData = await response.json();
      
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('User registered successfully');
      expect(responseData.token).toBe('mocked_jwt_token');
      expect(responseData.user).toBeDefined();
      expect(responseData.user.username).toBe('testuser');
      expect(mockEnv.D1_DB.prepare).toHaveBeenCalledTimes(3); // Check username, email, insert
    });
    
    test('should return error when missing required fields', async () => {
      const mockRequest = {
        json: jest.fn().mockResolvedValue({
          f_name: 'Test',
          // Missing l_name and other required fields
          email: 'test@example.com'
        })
      };
      
      const response = await controller.createAccount(mockRequest);
      const responseData = await response.json();
      
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('Missing required fields');
      expect(response.status).toBe(400);
    });
    
    test('should return error when username already exists', async () => {
      // Mock the database to return existing username
      mockEnv.D1_DB.prepare = jest.fn(() => ({
        bind: jest.fn(() => ({
          first: jest.fn().mockResolvedValue({ username: 'existinguser' }),
          all: jest.fn().mockResolvedValue({ results: [] }),
          run: jest.fn().mockResolvedValue({ meta: { last_row_id: 123 } })
        }))
      }));
      
      const mockRequest = {
        json: jest.fn().mockResolvedValue({
          f_name: 'Test',
          l_name: 'User',
          username: 'existinguser',
          email: 'test@example.com',
          password: 'password123'
        })
      };
      
      const response = await controller.createAccount(mockRequest);
      const responseData = await response.json();
      
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('A user with this username already exists');
      expect(response.status).toBe(400);
    });
  });

  describe('login', () => {
    test('should log in successfully with valid credentials', async () => {
      // Mock DB to return a user
      mockEnv.D1_DB.prepare = jest.fn(() => ({
        bind: jest.fn(() => ({
          all: jest.fn().mockResolvedValue({ 
            results: [{
              userID: 123,
              username: 'testuser',
              f_name: 'Test',
              l_name: 'User',
              email: 'test@example.com',
              password: 'hashed_password'
            }] 
          }),
          first: jest.fn()
        }))
      }));
      
      const mockRequest = {
        json: jest.fn().mockResolvedValue({
          email: 'test@example.com',
          password: 'password123'
        })
      };
      
      const response = await controller.login(mockRequest);
      const responseData = await response.json();
      
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Login successful');
      expect(responseData.token).toBe('mocked_jwt_token');
      expect(responseData.user).toBeDefined();
      expect(responseData.user.username).toBe('testuser');
    });
    
    test('should return error for invalid credentials', async () => {
      // Mock password verification to fail
      jest.spyOn(authUtils, 'verifyPassword').mockResolvedValue(false);
      
      // Mock DB to return a user
      mockEnv.D1_DB.prepare = jest.fn(() => ({
        bind: jest.fn(() => ({
          all: jest.fn().mockResolvedValue({ 
            results: [{
              userID: 123,
              email: 'test@example.com',
              password: 'hashed_password'
            }] 
          }),
          first: jest.fn()
        }))
      }));
      
      const mockRequest = {
        json: jest.fn().mockResolvedValue({
          email: 'test@example.com',
          password: 'wrongpassword'
        })
      };
      
      const response = await controller.login(mockRequest);
      const responseData = await response.json();
      
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Invalid email or password');
      expect(response.status).toBe(401);
    });
  });

  describe('getUserProfile', () => {
    test('should return user profile for valid token', async () => {
      // Mock DB to return a user
      mockEnv.D1_DB.prepare = jest.fn(() => ({
        bind: jest.fn(() => ({
          first: jest.fn().mockResolvedValue({
            userID: 123,
            f_name: 'Test',
            l_name: 'User',
            email: 'test@example.com',
            phone: '1234567890'
          })
        }))
      }));
      
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Bearer valid_token')
        }
      };
      
      const response = await controller.getUserProfile(mockRequest);
      const responseData = await response.json();
      
      expect(responseData.success).toBe(true);
      expect(responseData.user).toBeDefined();
      expect(responseData.user.userID).toBe(123);
      expect(responseData.user.email).toBe('test@example.com');
      expect(authUtils.verifyJWT).toHaveBeenCalledWith('valid_token');
    });
    
    test('should return error when no token provided', async () => {
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('')
        }
      };
      
      const response = await controller.getUserProfile(mockRequest);
      const responseData = await response.json();
      
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Authentication token required');
      expect(response.status).toBe(401);
    });
  });
});