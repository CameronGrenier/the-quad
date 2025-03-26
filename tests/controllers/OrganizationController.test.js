import { OrganizationController } from '../../client/src/controllers/OrganizationController.js';
import * as formDataUtils from '../../client/src/utils/formData.js';
import * as storageUtils from '../../client/src/utils/storage.js';
import * as authUtils from '../../client/src/utils/auth.js';

describe('OrganizationController', () => {
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
            run: jest.fn().mockResolvedValue({ meta: { last_row_id: 456 } })
          }))
        }))
      }
    };
    
    controller = new OrganizationController(mockEnv, corsHeaders);
    
    // Mock utilities
    jest.spyOn(formDataUtils, 'parseFormData').mockImplementation(async (req) => {
      const formData = new FormData();
      const data = req.formData ? await req.formData() : {};
      
      for (const [key, value] of Object.entries(data)) {
        formData.append(key, value);
      }
      
      // Add get method
      formData.get = (key) => data[key];
      
      return formData;
    });
    
    jest.spyOn(storageUtils, 'uploadFileToR2').mockResolvedValue('/images/org_thumb_123.jpg');
    jest.spyOn(authUtils, 'verifyJWT').mockReturnValue({ userId: 123, email: 'test@example.com' });
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('registerOrganization', () => {
    test('should create a new organization successfully', async () => {
      const mockFormData = {
        name: 'Test Organization',
        description: 'Test Description',
        userID: '123',
        privacy: 'public',
        thumbnail: new File(['test'], 'thumbnail.jpg', { type: 'image/jpeg' })
      };
      
      const mockRequest = {
        formData: jest.fn().mockResolvedValue(mockFormData)
      };
      
      const response = await controller.registerOrganization(mockRequest);
      const responseData = await response.json();
      
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Organization created successfully');
      expect(responseData.orgID).toBe(456);
      expect(mockEnv.D1_DB.prepare).toHaveBeenCalledTimes(3); // Check org, insert org, insert admin
    });
    
    test('should return error when missing required fields', async () => {
      const mockFormData = {
        description: 'Test Description',
        // Missing name and userID
        privacy: 'public'
      };
      
      const mockRequest = {
        formData: jest.fn().mockResolvedValue(mockFormData)
      };
      
      const response = await controller.registerOrganization(mockRequest);
      const responseData = await response.json();
      
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('Organization name and user ID are required');
      expect(response.status).toBe(400);
    });
    
    test('should return error when organization name already exists', async () => {
      // Mock the database to return existing org
      mockEnv.D1_DB.prepare = jest.fn(() => ({
        bind: jest.fn(() => ({
          first: jest.fn().mockResolvedValue({ name: 'Existing Org' }),
          all: jest.fn(),
          run: jest.fn()
        }))
      }));
      
      const mockFormData = {
        name: 'Existing Org',
        description: 'Test Description',
        userID: '123',
        privacy: 'public'
      };
      
      const mockRequest = {
        formData: jest.fn().mockResolvedValue(mockFormData)
      };
      
      const response = await controller.registerOrganization(mockRequest);
      const responseData = await response.json();
      
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('An organization with this name already exists');
      expect(response.status).toBe(400);
    });
  });

  describe('getUserOrganizations', () => {
    test('should return user organizations for valid token', async () => {
      // Mock DB to return organizations
      mockEnv.D1_DB.prepare = jest.fn(() => ({
        bind: jest.fn(() => ({
          all: jest.fn().mockResolvedValue({ 
            results: [
              { orgID: 1, name: 'Organization 1' },
              { orgID: 2, name: 'Organization 2' }
            ] 
          }),
          first: jest.fn()
        }))
      }));
      
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Bearer valid_token')
        }
      };
      
      const response = await controller.getUserOrganizations(mockRequest);
      const responseData = await response.json();
      
      expect(responseData.success).toBe(true);
      expect(responseData.organizations).toHaveLength(2);
      expect(responseData.organizations[0].name).toBe('Organization 1');
      expect(authUtils.verifyJWT).toHaveBeenCalledWith('valid_token');
    });
    
    test('should return error when no token provided', async () => {
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('')
        }
      };
      
      const response = await controller.getUserOrganizations(mockRequest);
      const responseData = await response.json();
      
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Authentication token required');
      expect(response.status).toBe(401);
    });
  });
});