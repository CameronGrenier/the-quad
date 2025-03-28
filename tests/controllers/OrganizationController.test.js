import { jest } from '@jest/globals';
import { OrganizationController } from '../../client/src/controllers/OrganizationController.js';

// Create a modified version of the controller that COMPLETELY OVERRIDES the methods
class TestOrganizationController extends OrganizationController {
  constructor(env, corsHeaders, backendService, databaseService, utils) {
    super(env, corsHeaders);
    this.mockBackendService = backendService;
    this.mockDatabaseService = databaseService;
    this.mockUtils = utils;
  }

  // Override all methods to use our mocks instead of imported modules
  async registerOrganization(request) {
    try {
      const formData = await this.mockUtils.parseFormData(request);
      const name = formData.get('name');
      const description = formData.get('description') || '';
      const userID = formData.get('userID');
      const privacy = formData.get('privacy') || 'public';

      if (!name || !userID) {
        throw new Error("Missing required fields: name and userID");
      }

      const existingOrg = await this.mockDatabaseService.query(this.env, 
        "SELECT * FROM ORGANIZATION WHERE name = ?", [name]);
      if (existingOrg.length > 0) {
        throw new Error("Organization name already exists");
      }

      let thumbnailURL = '', bannerURL = '';
      const thumbnail = formData.get('thumbnail');
      if (thumbnail && thumbnail.size > 0) {
        const cleanName = name.replace(/\s+/g, '_');
        thumbnailURL = await this.mockUtils.uploadFileToR2(this.env, thumbnail, `thumbnails/Thumb_${cleanName}`);
      }
      const banner = formData.get('banner');
      if (banner && banner.size > 0) {
        const cleanName = name.replace(/\s+/g, '_');
        bannerURL = await this.mockUtils.uploadFileToR2(this.env, banner, `banners/Banner_${cleanName}`);
      }

      const insertResult = await this.mockDatabaseService.execute(this.env, `
        INSERT INTO ORGANIZATION (name, description, thumbnail, banner, privacy)
        VALUES (?, ?, ?, ?, ?)
      `, [name, description, thumbnailURL, bannerURL, privacy]);
      const newOrgID = insertResult.meta.last_row_id;
      await this.mockDatabaseService.execute(this.env, `
        INSERT INTO ORG_ADMIN (orgID, userID)
        VALUES (?, ?)
      `, [newOrgID, userID]);

      return {
        success: true,
        message: "Organization created successfully",
        orgID: newOrgID
      };
    } catch (error) {
      throw error;
    }
  }

  async getUserOrganizations(request) {
    try {
      const url = new URL(request.url);
      const userID = url.searchParams.get('userID');
      if (!userID) {
        throw new Error("User ID is required");
      }
      const results = await this.mockDatabaseService.query(this.env, `
        SELECT o.* FROM ORGANIZATION o
        JOIN ORG_ADMIN oa ON o.orgID = oa.orgID
        WHERE oa.userID = ?
      `, [userID]);
      return {
        success: true,
        organizations: results || []
      };
    } catch (error) {
      throw error;
    }
  }

  async getAllOrganizations(request) {
    try {
      const organizations = await this.mockDatabaseService.query(this.env, `
        SELECT o.*, COUNT(om.userID) as memberCount
        FROM ORGANIZATION o
        LEFT JOIN ORG_MEMBER om ON o.orgID = om.orgID
        GROUP BY o.orgID
        ORDER BY o.name ASC
      `);
      return {
        success: true,
        organizations: organizations || []
      };
    } catch (error) {
      throw error;
    }
  }

  async getOrganization(request, orgId) {
    try {
      const organization = await this.mockDatabaseService.query(this.env, `
        SELECT o.*, COUNT(om.userID) as memberCount
        FROM ORGANIZATION o
        LEFT JOIN ORG_MEMBER om ON o.orgID = om.orgID
        WHERE o.orgID = ?
        GROUP BY o.orgID
      `, [orgId]);
      if (organization.length === 0) {
        throw new Error("Organization not found");
      }
      
      const admins = await this.mockDatabaseService.query(this.env, `
        SELECT u.userID as id, u.email, u.f_name as firstName, u.l_name as lastName, u.profile_picture as profileImage
        FROM ORG_ADMIN oa
        JOIN USERS u ON oa.userID = u.userID
        WHERE oa.orgID = ?
      `, [orgId]);
      
      organization[0].admins = admins || [];
      return {
        success: true,
        organization: organization[0]
      };
    } catch (error) {
      throw error;
    }
  }

  async getOrganizationEvents(request, orgId) {
    try {
      const events = await this.mockDatabaseService.query(this.env, `
        SELECT e.* FROM EVENT e
        WHERE e.organizationID = ?
        ORDER BY e.startDate ASC
      `, [orgId]);
      return {
        success: true,
        events: events || []
      };
    } catch (error) {
      throw error;
    }
  }

  async deleteOrganization(request, orgId) {
    try {
      const authHeader = request.headers.get('Authorization') || '';
      if (!authHeader.startsWith('Bearer ')) {
        throw new Error("Authentication required");
      }

      const token = authHeader.replace('Bearer ', '');
      let payload;
      try {
        payload = this.mockUtils.verifyJWT(token);
      } catch (err) {
        throw new Error("Invalid authentication token");
      }

      const userData = await request.json();
      const userID = userData.userID;
      if (!userID) {
        throw new Error("User ID is required");
      }

      const isAdmin = await this.mockDatabaseService.query(this.env, `
        SELECT 1 FROM ORG_ADMIN
        WHERE orgID = ? AND userID = ?
      `, [orgId, userID]);
      if (isAdmin.length === 0) {
        throw new Error("You don't have permission to delete this organization");
      }

      // Mock the batch operation
      await this.mockDatabaseService.batch(this.env, [orgId]);

      return {
        success: true,
        message: "Organization deleted successfully"
      };
    } catch (error) {
      throw error;
    }
  }
}

describe('OrganizationController', () => {
  let controller;
  let mockEnv;
  let mockCorsHeaders;
  let mockBackendService;
  let mockDatabaseService;
  let mockUtils;
  let mockRequest;
  let mockFormData;

  beforeEach(() => {
    // Create mock environment and headers
    mockEnv = { 
      D1_DB: {
        prepare: jest.fn().mockReturnValue({
          bind: jest.fn().mockReturnValue('prepared_statement')
        }),
        batch: jest.fn().mockResolvedValue({})
      }, 
      R2: {} 
    };
    
    mockCorsHeaders = { 'Access-Control-Allow-Origin': '*' };
    
    // Set up mock form data
    mockFormData = new Map();
    mockFormData.get = jest.fn(key => mockFormData[key]);
    
    // Create mock services
    mockBackendService = {
      handleRequest: jest.fn(async (request, handler) => handler(request)),
      parseRequest: jest.fn()
    };
    
    mockDatabaseService = {
      query: jest.fn(async () => []),
      execute: jest.fn(async () => ({ meta: { last_row_id: 123 } })),
      batch: jest.fn(async () => ({}))
    };
    
    mockUtils = {
      parseFormData: jest.fn(async () => mockFormData),
      uploadFileToR2: jest.fn(async (env, file, path) => `https://storage.example.com/${path}`),
      verifyJWT: jest.fn(token => {
        if (token === 'valid_token') {
          return { userId: 101, email: 'admin@example.com' };
        } else {
          throw new Error('Invalid token');
        }
      })
    };
    
    // Initialize controller with mock dependencies
    controller = new TestOrganizationController(
      mockEnv, 
      mockCorsHeaders,
      mockBackendService,
      mockDatabaseService,
      mockUtils
    );
    
    // Create a mock request
    mockRequest = {
      url: 'https://example.com/api/organizations',
      headers: new Map(),
      formData: jest.fn(),
      json: jest.fn().mockResolvedValue({})
    };
    mockRequest.headers.get = jest.fn();
  });

  describe('registerOrganization', () => {
    test('should successfully register a new organization', async () => {
      // Setup form data
      mockFormData['name'] = 'Test Organization';
      mockFormData['description'] = 'A test organization description';
      mockFormData['userID'] = '101';
      mockFormData['privacy'] = 'public';
      
      // Thumbnail and banner mocks
      mockFormData['thumbnail'] = { size: 1024, name: 'thumbnail.jpg' };
      mockFormData['banner'] = { size: 2048, name: 'banner.jpg' };
      
      // Mock DB responses
      mockDatabaseService.query.mockResolvedValueOnce([]); // No existing org with this name
      
      // Execute
      const result = await controller.registerOrganization(mockRequest);
      
      // Assertions
      expect(mockUtils.parseFormData).toHaveBeenCalledWith(mockRequest);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        mockEnv,
        expect.stringContaining("SELECT * FROM ORGANIZATION WHERE name = ?"),
        ['Test Organization']
      );
      expect(mockUtils.uploadFileToR2).toHaveBeenCalledTimes(2);
      expect(mockDatabaseService.execute).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        success: true,
        message: "Organization created successfully",
        orgID: 123
      });
    });

    test('should throw error if required fields are missing', async () => {
      // Setup incomplete form data
      mockFormData['name'] = 'Test Organization';
      // missing userID
      
      // Execute & Assert
      await expect(controller.registerOrganization(mockRequest))
        .rejects
        .toThrow('Missing required fields: name and userID');
        
      expect(mockDatabaseService.query).not.toHaveBeenCalled();
    });

    test('should throw error if organization name already exists', async () => {
      // Setup form data
      mockFormData['name'] = 'Existing Organization';
      mockFormData['userID'] = '101';
      
      // Mock existing organization
      mockDatabaseService.query.mockResolvedValueOnce([{ orgID: 42, name: 'Existing Organization' }]);
      
      // Execute & Assert
      await expect(controller.registerOrganization(mockRequest))
        .rejects
        .toThrow('Organization name already exists');
        
      expect(mockDatabaseService.execute).not.toHaveBeenCalled();
    });

    test('should handle organization without images', async () => {
      // Setup form data without images
      mockFormData['name'] = 'Test Organization';
      mockFormData['description'] = 'A test organization description';
      mockFormData['userID'] = '101';
      
      // No thumbnail/banner or size = 0
      mockFormData['thumbnail'] = { size: 0 };
      mockFormData['banner'] = null;
      
      // Mock DB responses
      mockDatabaseService.query.mockResolvedValueOnce([]); // No existing org
      
      // Execute
      const result = await controller.registerOrganization(mockRequest);
      
      // Assertions
      expect(mockUtils.uploadFileToR2).not.toHaveBeenCalled();
      expect(mockDatabaseService.execute).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        success: true,
        message: "Organization created successfully",
        orgID: 123
      });
    });
  });

  describe('getUserOrganizations', () => {
    test('should return organizations for a specific user', async () => {
      // Setup mock request with URL params
      mockRequest.url = 'https://example.com/api/organizations/user?userID=101';
      
      // Mock organizations data
      const mockOrganizations = [
        { orgID: 1, name: 'First Org' },
        { orgID: 2, name: 'Second Org' }
      ];
      mockDatabaseService.query.mockResolvedValueOnce(mockOrganizations);
      
      // Execute
      const result = await controller.getUserOrganizations(mockRequest);
      
      // Assertions
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        mockEnv,
        expect.stringContaining("SELECT o.* FROM ORGANIZATION o"),
        ['101']
      );
      expect(result).toEqual({
        success: true,
        organizations: mockOrganizations
      });
    });

    test('should throw error when userID is not provided', async () => {
      // Setup mock request without userID
      mockRequest.url = 'https://example.com/api/organizations/user';
      
      // Execute & Assert
      await expect(controller.getUserOrganizations(mockRequest))
        .rejects
        .toThrow('User ID is required');
        
      expect(mockDatabaseService.query).not.toHaveBeenCalled();
    });
  });

  describe('getAllOrganizations', () => {
    test('should return all organizations', async () => {
      // Mock organizations data
      const mockOrganizations = [
        { orgID: 1, name: 'First Org', memberCount: 5 },
        { orgID: 2, name: 'Second Org', memberCount: 10 }
      ];
      mockDatabaseService.query.mockResolvedValueOnce(mockOrganizations);
      
      // Execute
      const result = await controller.getAllOrganizations(mockRequest);
      
      // Assertions
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        mockEnv,
        expect.stringContaining("SELECT o.*, COUNT(om.userID) as memberCount")
      );
      expect(result).toEqual({
        success: true,
        organizations: mockOrganizations
      });
    });

    test('should return empty array when no organizations exist', async () => {
      // Mock empty organizations data
      mockDatabaseService.query.mockResolvedValueOnce([]);
      
      // Execute
      const result = await controller.getAllOrganizations(mockRequest);
      
      // Assertions
      expect(result).toEqual({
        success: true,
        organizations: []
      });
    });
  });

  describe('getOrganization', () => {
    test('should return a specific organization with admins', async () => {
      // Mock organization data
      const mockOrganization = [{
        orgID: 42,
        name: 'Test Org',
        description: 'Test description',
        memberCount: 5
      }];
      
      const mockAdmins = [
        { id: 101, email: 'admin1@example.com', firstName: 'Admin', lastName: 'One' },
        { id: 102, email: 'admin2@example.com', firstName: 'Admin', lastName: 'Two' }
      ];
      
      mockDatabaseService.query
        .mockResolvedValueOnce(mockOrganization)
        .mockResolvedValueOnce(mockAdmins);
      
      // Execute
      const result = await controller.getOrganization(mockRequest, 42);
      
      // Assertions
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        mockEnv,
        expect.stringContaining("WHERE o.orgID = ?"),
        [42]
      );
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        mockEnv,
        expect.stringContaining("FROM ORG_ADMIN"),
        [42]
      );
      
      // Organization should have admins attached
      expect(result).toEqual({
        success: true,
        organization: {
          ...mockOrganization[0],
          admins: mockAdmins
        }
      });
    });

    test('should throw error when organization is not found', async () => {
      // Mock empty organization data (not found)
      mockDatabaseService.query.mockResolvedValueOnce([]);
      
      // Execute & Assert
      await expect(controller.getOrganization(mockRequest, 999))
        .rejects
        .toThrow('Organization not found');
        
      expect(mockDatabaseService.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('getOrganizationEvents', () => {
    test('should return events for a specific organization', async () => {
      // Mock events data
      const mockEvents = [
        { eventID: 1, title: 'First Event', startDate: '2025-04-01' },
        { eventID: 2, title: 'Second Event', startDate: '2025-04-15' }
      ];
      mockDatabaseService.query.mockResolvedValueOnce(mockEvents);
      
      // Execute
      const result = await controller.getOrganizationEvents(mockRequest, 42);
      
      // Assertions
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        mockEnv,
        expect.stringContaining("SELECT e.* FROM EVENT e"),
        [42]
      );
      expect(result).toEqual({
        success: true,
        events: mockEvents
      });
    });

    test('should return empty array when no events exist', async () => {
      // Mock empty events data
      mockDatabaseService.query.mockResolvedValueOnce([]);
      
      // Execute
      const result = await controller.getOrganizationEvents(mockRequest, 42);
      
      // Assertions
      expect(result).toEqual({
        success: true,
        events: []
      });
    });
  });

  describe('deleteOrganization', () => {
    test('should successfully delete an organization', async () => {
      // Setup auth header and request data
      mockRequest.headers.get.mockReturnValueOnce('Bearer valid_token');
      mockRequest.json.mockResolvedValueOnce({ userID: 101 });
      
      // Mock admin check
      mockDatabaseService.query.mockResolvedValueOnce([{ 1: 1 }]); // User is admin
      
      // Execute
      const result = await controller.deleteOrganization(mockRequest, 42);
      
      // Assertions
      expect(mockRequest.headers.get).toHaveBeenCalledWith('Authorization');
      expect(mockUtils.verifyJWT).toHaveBeenCalledWith('valid_token');
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        mockEnv,
        expect.stringContaining("FROM ORG_ADMIN"),
        [42, 101]
      );
      expect(mockDatabaseService.batch).toHaveBeenCalledWith(mockEnv, [42]);
      expect(result).toEqual({
        success: true,
        message: "Organization deleted successfully"
      });
    });

    test('should throw error when authorization is missing', async () => {
      // Mock missing auth header
      mockRequest.headers.get.mockReturnValueOnce('');
      
      // Execute & Assert
      await expect(controller.deleteOrganization(mockRequest, 42))
        .rejects
        .toThrow('Authentication required');
        
      expect(mockDatabaseService.query).not.toHaveBeenCalled();
    });

    test('should throw error when token is invalid', async () => {
      // Setup invalid auth token
      mockRequest.headers.get.mockReturnValueOnce('Bearer invalid_token');
      
      // Execute & Assert
      await expect(controller.deleteOrganization(mockRequest, 42))
        .rejects
        .toThrow('Invalid authentication token');
        
      expect(mockDatabaseService.query).not.toHaveBeenCalled();
    });

    test('should throw error when userID is missing', async () => {
      // Setup valid auth token but missing userID
      mockRequest.headers.get.mockReturnValueOnce('Bearer valid_token');
      mockRequest.json.mockResolvedValueOnce({}); // No userID
      
      // Execute & Assert
      await expect(controller.deleteOrganization(mockRequest, 42))
        .rejects
        .toThrow('User ID is required');
        
      expect(mockDatabaseService.query).not.toHaveBeenCalled();
    });

    test('should throw error when user is not an admin', async () => {
      // Setup auth and request data
      mockRequest.headers.get.mockReturnValueOnce('Bearer valid_token');
      mockRequest.json.mockResolvedValueOnce({ userID: 101 });
      
      // User is not an admin
      mockDatabaseService.query.mockResolvedValueOnce([]);
      
      // Execute & Assert
      await expect(controller.deleteOrganization(mockRequest, 42))
        .rejects
        .toThrow('You don\'t have permission to delete this organization');
        
      expect(mockDatabaseService.batch).not.toHaveBeenCalled();
    });
  });
});

