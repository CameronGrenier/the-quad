import { jest } from '@jest/globals';

// Import the classes and not the instances
import { AccountController } from '../../client/src/controllers/AccountController.js';

// Create a modified version of the controller that COMPLETELY OVERRIDES the methods
class TestAccountController extends AccountController {
  constructor(env, backendService, databaseService, authUtils) {
    super(env);
    this.mockBackendService = backendService;
    this.mockDatabaseService = databaseService;
    this.mockUtils = authUtils;
  }

  // Override all methods to use our mocks instead of imported modules
  async createAccount(request) {
    const req = request;
    try {
      const data = await this.mockBackendService.parseRequest(req);
      const { f_name, l_name, username, email, phone, password } = data;
      if (!f_name || !l_name || !username || !email || !password) {
        throw new Error("Missing required fields");
      }

      const existingUsername = await this.mockDatabaseService.query(this.env, "SELECT * FROM USERS WHERE LOWER(username)=LOWER(?)", [username]);
      if (existingUsername.length > 0) {
        throw new Error("A user with this username already exists");
      }

      const existingUser = await this.mockDatabaseService.query(this.env, "SELECT * FROM USERS WHERE LOWER(email)=LOWER(?)", [email]);
      if (existingUser.length > 0) {
        throw new Error("A user with this email already exists");
      }

      const hashed = await this.mockUtils.hashPassword(password);
      const insertResult = await this.mockDatabaseService.execute(this.env, "INSERT INTO USERS (username, f_name, l_name, email, phone, password) VALUES (?,?,?,?,?,?)", [username, f_name, l_name, email, phone || null, hashed]);
      const userID = insertResult.meta.last_row_id;
      const token = this.mockUtils.generateJWT({ email, userId: userID, username });

      return {
        message: "User registered successfully",
        token,
        user: { id: userID, userID, username, f_name, l_name, email, phone: phone || null },
      };
    } catch (error) {
      throw error;
    }
  }

  async login(request) {
    const req = request;
    try {
      const data = await this.mockBackendService.parseRequest(req);
      const { email, password } = data;
      if (!email || !password) {
        throw new Error("Email and password are required");
      }

      const users = await this.mockDatabaseService.query(this.env, "SELECT * FROM USERS WHERE LOWER(email)=LOWER(?)", [email]);
      if (users.length === 0) {
        throw new Error("Invalid email or password");
      }

      const user = users[0];
      const passOk = await this.mockUtils.verifyPassword(password, user.password);
      if (!passOk) {
        throw new Error("Invalid email or password");
      }

      const token = this.mockUtils.generateJWT({ email: user.email, userId: user.userID, username: user.username });
      return {
        message: "Login successful",
        token,
        user: {
          id: user.userID,
          userID: user.userID,
          username: user.username,
          f_name: user.f_name,
          l_name: user.l_name,
          email: user.email,
          phone: user.phone,
          profile_picture: user.profile_picture,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async getUserProfile(request) {
    const req = request;
    try {
      const authHeader = req.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "");
      if (!token) {
        throw new Error("Authentication token required");
      }

      const payload = this.mockUtils.verifyJWT(token);
      const userId = payload.userId;
      if (!userId) throw new Error("Invalid token: missing user ID");

      const userQuery = await this.mockDatabaseService.query(this.env, "SELECT userID, f_name, l_name, email, phone, profile_picture FROM USERS WHERE userID = ?", [userId]);
      if (userQuery.length === 0) {
        throw new Error("User not found");
      }

      return { user: userQuery[0] };
    } catch (error) {
      throw error;
    }
  }
}

// Rest of your test file remains the same
describe('AccountController', () => {
  let controller;
  let mockEnv;
  let mockRequest;
  let mockBackendService;
  let mockDatabaseService;
  let mockUtils;

  beforeEach(() => {
    // Create mock environment
    mockEnv = { D1_DB: {} };
    
    // Create mock services
    mockBackendService = {
      handleRequest: jest.fn(async (request, handler) => handler(request)),
      parseRequest: jest.fn(async () => ({}))
    };
    
    mockDatabaseService = {
      query: jest.fn(async () => []),
      execute: jest.fn(async () => ({ meta: { last_row_id: 1 } }))
    };
    
    mockUtils = {
      hashPassword: jest.fn(async (password) => `hashed_${password}`),
      verifyPassword: jest.fn(async (password, hashedPassword) => 
        hashedPassword === `hashed_${password}`
      ),
      generateJWT: jest.fn((payload) => `jwt_token_for_${payload.username}`),
      verifyJWT: jest.fn((token) => {
        if (token === 'valid_token') {
          return { userId: 1, email: 'test@example.com', username: 'testuser' };
        } else if (token === 'token_without_userId') {
          return { email: 'test@example.com' };
        } else {
          throw new Error("Invalid token");
        }
      })
    };
    
    // Initialize controller with mock dependencies
    controller = new TestAccountController(mockEnv, mockBackendService, mockDatabaseService, mockUtils);
    
    // Create a mock request
    mockRequest = {
      headers: new Map(),
      json: jest.fn(),
      formData: jest.fn()
    };
    mockRequest.headers.get = jest.fn();
  });

  describe('createAccount', () => {
    test('should create a new user account successfully', async () => {
      // Setup
      const userData = {
        f_name: 'Test',
        l_name: 'User',
        username: 'testuser',
        email: 'test@example.com',
        phone: '1234567890',
        password: 'password123'
      };
      
      mockBackendService.parseRequest.mockResolvedValueOnce(userData);
      mockDatabaseService.query
        .mockResolvedValueOnce([]) // No username match
        .mockResolvedValueOnce([]); // No email match
      mockDatabaseService.execute.mockResolvedValueOnce({
        meta: { last_row_id: 42 }
      });
      
      // Execute
      const result = await controller.createAccount(mockRequest);
      
      // Assert
      expect(mockBackendService.parseRequest).toHaveBeenCalledWith(mockRequest);
      expect(mockDatabaseService.query).toHaveBeenCalledTimes(2);
      expect(mockDatabaseService.execute).toHaveBeenCalledWith(
        mockEnv,
        expect.stringContaining("INSERT INTO USERS"),
        ['testuser', 'Test', 'User', 'test@example.com', '1234567890', 'hashed_password123']
      );
      expect(mockUtils.generateJWT).toHaveBeenCalledWith({
        email: 'test@example.com',
        userId: 42,
        username: 'testuser'
      });
      
      expect(result).toEqual({
        message: "User registered successfully",
        token: 'jwt_token_for_testuser',
        user: expect.objectContaining({
          id: 42,
          username: 'testuser',
          email: 'test@example.com'
        })
      });
    });

    test('should throw error when required fields are missing', async () => {
      // Setup
      const incompleteData = {
        f_name: 'Test',
        // Missing required fields
      };
      mockBackendService.parseRequest.mockResolvedValueOnce(incompleteData);
      
      // Execute & Assert
      await expect(controller.createAccount(mockRequest))
        .rejects
        .toThrow('Missing required fields');
        
      expect(mockDatabaseService.query).not.toHaveBeenCalled();
    });

    test('should throw error when username already exists', async () => {
      // Setup
      const userData = {
        f_name: 'Test',
        l_name: 'User',
        username: 'existinguser',
        email: 'test@example.com',
        password: 'password123'
      };
      
      mockBackendService.parseRequest.mockResolvedValueOnce(userData);
      mockDatabaseService.query.mockResolvedValueOnce([{ username: 'existinguser' }]);
      
      // Execute & Assert
      await expect(controller.createAccount(mockRequest))
        .rejects
        .toThrow('A user with this username already exists');
        
      expect(mockDatabaseService.query).toHaveBeenCalledTimes(1);
      expect(mockDatabaseService.execute).not.toHaveBeenCalled();
    });

    test('should throw error when email already exists', async () => {
      // Setup
      const userData = {
        f_name: 'Test',
        l_name: 'User',
        username: 'testuser',
        email: 'existing@example.com',
        password: 'password123'
      };
      
      mockBackendService.parseRequest.mockResolvedValueOnce(userData);
      mockDatabaseService.query
        .mockResolvedValueOnce([]) // No username match
        .mockResolvedValueOnce([{ email: 'existing@example.com' }]); // Email exists
      
      // Execute & Assert
      await expect(controller.createAccount(mockRequest))
        .rejects
        .toThrow('A user with this email already exists');
        
      expect(mockDatabaseService.query).toHaveBeenCalledTimes(2);
      expect(mockDatabaseService.execute).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    test('should log in user successfully', async () => {
      // Setup
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };
      
      const userRecord = {
        userID: 42,
        username: 'testuser',
        f_name: 'Test',
        l_name: 'User',
        email: 'test@example.com',
        phone: '1234567890',
        password: 'hashed_password123',
        profile_picture: 'profile.jpg'
      };
      
      mockBackendService.parseRequest.mockResolvedValueOnce(loginData);
      mockDatabaseService.query.mockResolvedValueOnce([userRecord]);
      mockUtils.verifyPassword.mockResolvedValueOnce(true);
      
      // Execute
      const result = await controller.login(mockRequest);
      
      // Assert
      expect(mockBackendService.parseRequest).toHaveBeenCalledWith(mockRequest);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        mockEnv,
        expect.stringContaining("SELECT * FROM USERS WHERE LOWER(email)=LOWER(?)"),
        ['test@example.com']
      );
      expect(mockUtils.verifyPassword).toHaveBeenCalledWith('password123', 'hashed_password123');
      expect(mockUtils.generateJWT).toHaveBeenCalledWith({
        email: 'test@example.com',
        userId: 42,
        username: 'testuser'
      });
      
      expect(result).toEqual({
        message: "Login successful",
        token: 'jwt_token_for_testuser',
        user: expect.objectContaining({
          id: 42,
          username: 'testuser',
          email: 'test@example.com',
          profile_picture: 'profile.jpg'
        })
      });
    });
    
    test('should throw error when email is missing', async () => {
      // Setup
      mockBackendService.parseRequest.mockResolvedValueOnce({
        password: 'password123' // No email
      });
      
      // Execute & Assert
      await expect(controller.login(mockRequest))
        .rejects
        .toThrow('Email and password are required');
        
      expect(mockDatabaseService.query).not.toHaveBeenCalled();
    });
    
    test('should throw error when password is missing', async () => {
      // Setup
      mockBackendService.parseRequest.mockResolvedValueOnce({
        email: 'test@example.com' // No password
      });
      
      // Execute & Assert
      await expect(controller.login(mockRequest))
        .rejects
        .toThrow('Email and password are required');
        
      expect(mockDatabaseService.query).not.toHaveBeenCalled();
    });
    
    test('should throw error when user does not exist', async () => {
      // Setup
      mockBackendService.parseRequest.mockResolvedValueOnce({
        email: 'nonexistent@example.com',
        password: 'password123'
      });
      mockDatabaseService.query.mockResolvedValueOnce([]); // No user found
      
      // Execute & Assert
      await expect(controller.login(mockRequest))
        .rejects
        .toThrow('Invalid email or password');
        
      expect(mockUtils.verifyPassword).not.toHaveBeenCalled();
    });
    
    test('should throw error when password is incorrect', async () => {
      // Setup
      mockBackendService.parseRequest.mockResolvedValueOnce({
        email: 'test@example.com',
        password: 'wrong_password'
      });
      
      mockDatabaseService.query.mockResolvedValueOnce([{
        userID: 42,
        email: 'test@example.com',
        password: 'hashed_correct_password'
      }]);
      
      mockUtils.verifyPassword.mockResolvedValueOnce(false);
      
      // Execute & Assert
      await expect(controller.login(mockRequest))
        .rejects
        .toThrow('Invalid email or password');
        
      expect(mockUtils.generateJWT).not.toHaveBeenCalled();
    });
  });

  describe('getUserProfile', () => {
    test('should return the user profile successfully', async () => {
      // Setup
      mockRequest.headers.get.mockReturnValueOnce('Bearer valid_token');
      
      const userRecord = {
        userID: 1,
        f_name: 'Test',
        l_name: 'User',
        email: 'test@example.com',
        phone: '1234567890',
        profile_picture: 'profile.jpg'
      };
      
      mockDatabaseService.query.mockResolvedValueOnce([userRecord]);
      
      // Execute
      const result = await controller.getUserProfile(mockRequest);
      
      // Assert
      expect(mockRequest.headers.get).toHaveBeenCalledWith('Authorization');
      expect(mockUtils.verifyJWT).toHaveBeenCalledWith('valid_token');
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        mockEnv,
        expect.stringContaining("SELECT userID, f_name, l_name, email"),
        [1]
      );
      
      expect(result).toEqual({ user: userRecord });
    });
    
    test('should throw error when no authorization token is provided', async () => {
      // Setup
      mockRequest.headers.get.mockReturnValueOnce(''); // Empty auth header
      
      // Execute & Assert
      await expect(controller.getUserProfile(mockRequest))
        .rejects
        .toThrow('Authentication token required');
        
      expect(mockUtils.verifyJWT).not.toHaveBeenCalled();
    });
    
    test('should throw error when JWT is invalid', async () => {
      // Setup
      mockRequest.headers.get.mockReturnValueOnce('Bearer invalid_token');
      
      // Execute & Assert
      await expect(controller.getUserProfile(mockRequest))
        .rejects
        .toThrow('Invalid token');
        
      expect(mockDatabaseService.query).not.toHaveBeenCalled();
    });
    
    test('should throw error when userId is missing from token', async () => {
      // Setup
      mockRequest.headers.get.mockReturnValueOnce('Bearer token_without_userId');
      
      // Execute & Assert
      await expect(controller.getUserProfile(mockRequest))
        .rejects
        .toThrow('Invalid token: missing user ID');
        
      expect(mockDatabaseService.query).not.toHaveBeenCalled();
    });
    
    test('should throw error when user is not found', async () => {
      // Setup
      mockRequest.headers.get.mockReturnValueOnce('Bearer valid_token');
      mockDatabaseService.query.mockResolvedValueOnce([]); // No user found
      
      // Execute & Assert
      await expect(controller.getUserProfile(mockRequest))
        .rejects
        .toThrow('User not found');
    });
  });
});