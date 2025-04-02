import AccountController from './AccountController';

// Mock dependencies
jest.mock('../utils/formData.js', () => ({
  parseFormData: jest.fn().mockResolvedValue(new FormData()),
  getFormValue: jest.fn()
}));

describe('AccountController', () => {
  let accountController;
  let mockBackendService;
  let mockAuth;
  let mockCorsHeaders;
  let formDataUtil;
  
  beforeEach(() => {
    mockBackendService = {
      query: jest.fn().mockResolvedValue({ meta: { last_row_id: 1 } }),
      queryFirst: jest.fn(),
      queryAll: jest.fn(),
      uploadFile: jest.fn().mockResolvedValue('/images/profile_pic.jpg')
    };
    
    mockAuth = {
      hashPassword: jest.fn().mockResolvedValue('hashedPassword'),
      verifyPassword: jest.fn().mockResolvedValue(true),
      generateJWT: jest.fn().mockReturnValue('jwt-token'),
      verifyJWT: jest.fn().mockReturnValue({ userId: 1 })
    };
    
    mockCorsHeaders = { 'Content-Type': 'application/json' };
    
    accountController = new AccountController(
      {}, // mock env
      mockCorsHeaders,
      mockBackendService,
      mockAuth
    );
    
    // Import the mocked formDataUtil
    formDataUtil = require('../utils/formData.js');
    
    // Create mock FormData
    global.FormData = class FormData {
      constructor() {
        this.data = {};
      }
      
      append(key, value) {
        this.data[key] = value;
      }
      
      get(key) {
        return this.data[key] || null;
      }
    };
    
    // Mock Response
    global.Response = class Response {
      constructor(body, init = {}) {
        this.body = body;
        this.status = init.status || 200;
        this.headers = new Map();
        if (init.headers) {
          Object.entries(init.headers).forEach(([key, value]) => {
            this.headers.set(key, value);
          });
        }
      }
    };
  });
  
  describe('createAccount', () => {
    it('should create a new user account successfully', async () => {
      // Setup
      const mockRequest = {
        json: jest.fn().mockResolvedValue({
          f_name: 'John',
          l_name: 'Doe',
          username: 'johndoe',
          email: 'john@example.com',
          password: 'password123'
        })
      };
      
      mockBackendService.queryFirst
        .mockResolvedValueOnce(null)  // username check
        .mockResolvedValueOnce(null); // email check
      
      // Execute
      const result = await accountController.createAccount(mockRequest);
      
      // Assert
      expect(mockBackendService.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO USERS"),
        expect.arrayContaining(['johndoe', 'John', 'Doe', 'john@example.com', null, 'hashedPassword'])
      );
      expect(mockAuth.generateJWT).toHaveBeenCalled();
      
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(true);
    });
    
    it('should return error for missing required fields', async () => {
      const mockRequest = {
        json: jest.fn().mockResolvedValue({
          f_name: 'John',
          // Missing l_name, username, email, password
        })
      };
      
      const result = await accountController.createAccount(mockRequest);
      expect(result.status).toBe(400);
      
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(false);
      expect(bodyJson.error).toContain('Missing required fields');
    });
    
    it('should return error for duplicate username', async () => {
      const mockRequest = {
        json: jest.fn().mockResolvedValue({
          f_name: 'John',
          l_name: 'Doe',
          username: 'existing',
          email: 'john@example.com',
          password: 'password123'
        })
      };
      
      mockBackendService.queryFirst.mockResolvedValueOnce({
        username: 'existing'
      });
      
      const result = await accountController.createAccount(mockRequest);
      expect(result.status).toBe(400);
      
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(false);
      expect(bodyJson.error).toContain('already exists');
    });
    
    it('should return error for duplicate email', async () => {
      const mockRequest = {
        json: jest.fn().mockResolvedValue({
          f_name: 'John',
          l_name: 'Doe',
          username: 'johndoe',
          email: 'existing@example.com',
          password: 'password123'
        })
      };
      
      mockBackendService.queryFirst
        .mockResolvedValueOnce(null) // username check
        .mockResolvedValueOnce({ email: 'existing@example.com' }); // email check
      
      const result = await accountController.createAccount(mockRequest);
      expect(result.status).toBe(400);
      
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(false);
      expect(bodyJson.error).toContain('already exists');
    });
  });
  
  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockRequest = {
        json: jest.fn().mockResolvedValue({
          email: 'john@example.com',
          password: 'password123'
        })
      };
      
      mockBackendService.queryAll.mockResolvedValue({
        results: [{
          userID: 1,
          username: 'johndoe',
          f_name: 'John',
          l_name: 'Doe',
          email: 'john@example.com',
          phone: '1234567890',
          password: 'hashedPassword',
          profile_picture: '/images/profile.jpg'
        }]
      });
      
      const result = await accountController.login(mockRequest);
      const bodyJson = JSON.parse(result.body);
      
      expect(bodyJson.success).toBe(true);
      expect(bodyJson.token).toBe('jwt-token');
      expect(bodyJson.user.username).toBe('johndoe');
    });
    
    it('should return error for missing email or password', async () => {
      const mockRequest = {
        json: jest.fn().mockResolvedValue({
          email: 'john@example.com'
          // Missing password
        })
      };
      
      const result = await accountController.login(mockRequest);
      expect(result.status).toBe(400);
      
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(false);
      expect(bodyJson.error).toContain('required');
    });
    
    it('should return error for non-existent user', async () => {
      const mockRequest = {
        json: jest.fn().mockResolvedValue({
          email: 'nonexistent@example.com',
          password: 'password123'
        })
      };
      
      mockBackendService.queryAll.mockResolvedValue({ results: [] });
      
      const result = await accountController.login(mockRequest);
      expect(result.status).toBe(401);
      
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(false);
      expect(bodyJson.error).toContain('Invalid email or password');
    });
    
    it('should return error for incorrect password', async () => {
      const mockRequest = {
        json: jest.fn().mockResolvedValue({
          email: 'john@example.com',
          password: 'wrong_password'
        })
      };
      
      mockBackendService.queryAll.mockResolvedValue({
        results: [{
          userID: 1,
          email: 'john@example.com',
          password: 'hashedPassword'
        }]
      });
      
      mockAuth.verifyPassword.mockResolvedValueOnce(false);
      
      const result = await accountController.login(mockRequest);
      expect(result.status).toBe(401);
      
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(false);
      expect(bodyJson.error).toContain('Invalid email or password');
    });
  });
  
  describe('getUserProfile', () => {
    it('should return the user profile when properly authenticated', async () => {
      const mockRequest = {
        headers: {
          get: jest.fn().mockImplementation((name) => {
            if (name === 'Authorization') return 'Bearer jwt-token';
            return null;
          })
        }
      };
      
      mockBackendService.queryFirst.mockResolvedValue({
        userID: 1,
        f_name: 'John',
        l_name: 'Doe',
        email: 'john@example.com',
        phone: '1234567890',
        profile_picture: '/images/profile.jpg'
      });
      
      const result = await accountController.getUserProfile(mockRequest);
      const bodyJson = JSON.parse(result.body);
      
      expect(bodyJson.success).toBe(true);
      expect(bodyJson.user.userID).toBe(1);
      expect(bodyJson.user.f_name).toBe('John');
    });
    
    it('should return error when token is missing', async () => {
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue(null)
        }
      };
      
      const result = await accountController.getUserProfile(mockRequest);
      expect(result.status).toBe(401);
      
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(false);
      expect(bodyJson.error).toContain('Authentication token required');
    });
    
    it('should return error when user not found', async () => {
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Bearer jwt-token')
        }
      };
      
      mockBackendService.queryFirst.mockResolvedValue(null);
      
      const result = await accountController.getUserProfile(mockRequest);
      expect(result.status).toBe(404);
      
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(false);
      expect(bodyJson.error).toContain('User not found');
    });
  });
  
  describe('updateProfile', () => {
    it('should update the user profile successfully', async () => {
      const mockFormData = new FormData();
      mockFormData.append('f_name', 'Updated');
      mockFormData.append('l_name', 'User');
      mockFormData.append('email', 'updated@example.com');
      mockFormData.append('phone', '9876543210');
      
      formDataUtil.parseFormData.mockResolvedValueOnce(mockFormData);
      
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Bearer jwt-token')
        }
      };
      
      mockBackendService.queryFirst
        .mockResolvedValueOnce(null) // No duplicate email
        .mockResolvedValueOnce({ // Updated user
          userID: 1,
          f_name: 'Updated',
          l_name: 'User',
          email: 'updated@example.com',
          phone: '9876543210'
        });
      
      const result = await accountController.updateProfile(mockRequest);
      const bodyJson = JSON.parse(result.body);
      
      expect(bodyJson.success).toBe(true);
      expect(mockBackendService.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE USERS"), 
        expect.arrayContaining(['Updated', 'User', 'updated@example.com', '9876543210', 1])
      );
      expect(bodyJson.user.f_name).toBe('Updated');
    });
    
    it('should update profile with profile picture', async () => {
      const mockFormData = new FormData();
      mockFormData.append('f_name', 'John');
      mockFormData.append('l_name', 'Doe');
      mockFormData.append('email', 'john@example.com');
      
      // Add profile picture
      const profilePicture = { size: 1024, name: 'profile.jpg' };
      mockFormData.append('profile_picture', profilePicture);
      
      formDataUtil.parseFormData.mockResolvedValueOnce(mockFormData);
      
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Bearer jwt-token')
        }
      };
      
      mockBackendService.queryFirst
        .mockResolvedValueOnce(null) // No duplicate email
        .mockResolvedValueOnce({ // Updated user with profile picture
          userID: 1,
          f_name: 'John',
          l_name: 'Doe',
          email: 'john@example.com',
          profile_picture: '/images/profile_pic.jpg'
        });
      
      const result = await accountController.updateProfile(mockRequest);
      const bodyJson = JSON.parse(result.body);
      
      expect(bodyJson.success).toBe(true);
      expect(mockBackendService.uploadFile).toHaveBeenCalledWith(
        profilePicture,
        expect.stringContaining('profile_pictures/user_1')
      );
      expect(bodyJson.user.profile_picture).toBe('/images/profile_pic.jpg');
    });
    
    it('should return error when required fields are missing', async () => {
      const mockFormData = new FormData();
      mockFormData.append('f_name', 'John');
      // Missing l_name and email
      
      formDataUtil.parseFormData.mockResolvedValueOnce(mockFormData);
      
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Bearer jwt-token')
        }
      };
      
      const result = await accountController.updateProfile(mockRequest);
      expect(result.status).toBe(400);
      
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(false);
      expect(bodyJson.error).toContain('required');
    });
    
    it('should return error when email is already in use', async () => {
      const mockFormData = new FormData();
      mockFormData.append('f_name', 'John');
      mockFormData.append('l_name', 'Doe');
      mockFormData.append('email', 'existing@example.com');
      
      formDataUtil.parseFormData.mockResolvedValueOnce(mockFormData);
      
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Bearer jwt-token')
        }
      };
      
      mockBackendService.queryFirst.mockResolvedValueOnce({
        userID: 2, // Different user
        email: 'existing@example.com'
      });
      
      const result = await accountController.updateProfile(mockRequest);
      expect(result.status).toBe(400);
      
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(false);
      expect(bodyJson.error).toContain('already in use');
    });
  });
});