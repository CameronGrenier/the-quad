import OrganizationController from './OrganizationController';

// Mock dependencies
jest.mock('../utils/formData.js', () => ({
  parseFormData: jest.fn()
}));

describe('OrganizationController', () => {
  let orgController;
  let mockBackendService;
  let mockAuth;
  let mockCorsHeaders;
  let formDataUtil;
  
  beforeEach(() => {
    mockBackendService = {
      query: jest.fn().mockResolvedValue({ meta: { last_row_id: 1 } }),
      queryFirst: jest.fn(),
      queryAll: jest.fn(),
      uploadFile: jest.fn().mockResolvedValue('/images/test.jpg')
    };
    
    mockAuth = {
      verifyJWT: jest.fn().mockReturnValue({ userId: 1 })
    };
    
    mockCorsHeaders = { 'Content-Type': 'application/json' };
    
    orgController = new OrganizationController(
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

  describe('registerOrganization', () => {
    it('should create an organization successfully', async () => {
      // Setup mock form data
      const mockFormData = new FormData();
      mockFormData.append('name', 'Test Organization');
      mockFormData.append('description', 'Test Description');
      mockFormData.append('userID', '1');
      mockFormData.append('privacy', 'public');
      
      formDataUtil.parseFormData.mockResolvedValue(mockFormData);
      
      mockBackendService.queryFirst.mockResolvedValue(null); // No existing org
      
      const mockRequest = {};
      
      // Execute
      const result = await orgController.registerOrganization(mockRequest);
      
      // Assert
      expect(mockBackendService.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO ORGANIZATION"),
        expect.arrayContaining(['Test Organization', 'Test Description', '', '', 'public'])
      );
      
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(true);
      expect(bodyJson.message).toBe('Organization created successfully');
    });
    
    it('should return error for missing required fields', async () => {
      // Setup mock form data with missing fields
      const mockFormData = new FormData();
      mockFormData.append('description', 'Test Description');
      // Missing name and userID
      
      formDataUtil.parseFormData.mockResolvedValue(mockFormData);
      
      const mockRequest = {};
      
      // Execute
      const result = await orgController.registerOrganization(mockRequest);
      
      // Assert
      expect(result.status).toBe(400);
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(false);
      expect(bodyJson.error).toContain('Missing required fields');
    });
    
    it('should return error for duplicate organization name', async () => {
      // Setup mock form data
      const mockFormData = new FormData();
      mockFormData.append('name', 'Existing Organization');
      mockFormData.append('description', 'Test Description');
      mockFormData.append('userID', '1');
      
      formDataUtil.parseFormData.mockResolvedValue(mockFormData);
      
      // Mock an existing organization with the same name
      mockBackendService.queryFirst.mockResolvedValue({
        orgID: 2,
        name: 'Existing Organization'
      });
      
      const mockRequest = {};
      
      // Execute
      const result = await orgController.registerOrganization(mockRequest);
      
      // Assert
      expect(result.status).toBe(400);
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(false);
      expect(bodyJson.error).toContain('already exists');
    });
    
    it('should handle file uploads correctly', async () => {
      // Setup mock form data with files
      const mockFormData = new FormData();
      mockFormData.append('name', 'Test Organization');
      mockFormData.append('description', 'Test Description');
      mockFormData.append('userID', '1');
      
      // Add mock files
      const thumbnail = { size: 1024, name: 'thumbnail.jpg' };
      const banner = { size: 2048, name: 'banner.jpg' };
      mockFormData.append('thumbnail', thumbnail);
      mockFormData.append('banner', banner);
      
      formDataUtil.parseFormData.mockResolvedValue(mockFormData);
      mockBackendService.queryFirst.mockResolvedValue(null); // No existing org
      
      mockBackendService.uploadFile
        .mockResolvedValueOnce('/images/thumbnails/test.jpg') // For thumbnail
        .mockResolvedValueOnce('/images/banners/test.jpg');   // For banner
      
      const mockRequest = {};
      
      // Execute
      const result = await orgController.registerOrganization(mockRequest);
      
      // Assert
      expect(mockBackendService.uploadFile).toHaveBeenCalledTimes(2);
      expect(mockBackendService.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO ORGANIZATION"),
        expect.arrayContaining([
          'Test Organization', 
          'Test Description', 
          '/images/thumbnails/test.jpg', 
          '/images/banners/test.jpg',
          'public'
        ])
      );
      
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(true);
    });
  });

  describe('getUserOrganizations', () => {
    it('should return user organizations', async () => {
      // Setup
      const mockRequest = {
        url: 'https://example.com/api/user-organizations?userID=1'
      };
      
      const mockOrgs = {
        results: [
          { orgID: 1, name: 'Org 1', description: 'Desc 1' },
          { orgID: 2, name: 'Org 2', description: 'Desc 2' }
        ]
      };
      
      mockBackendService.queryAll.mockResolvedValue(mockOrgs);
      
      // Execute
      const result = await orgController.getUserOrganizations(mockRequest);
      
      // Assert
      expect(mockBackendService.queryAll).toHaveBeenCalledWith(
        expect.stringContaining("JOIN ORG_ADMIN"),
        ['1']
      );
      
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(true);
      expect(bodyJson.organizations).toEqual(mockOrgs.results);
    });
    
    it('should return error for missing userID', async () => {
      // Setup - request without userID
      const mockRequest = {
        url: 'https://example.com/api/user-organizations'
      };
      
      // Execute
      const result = await orgController.getUserOrganizations(mockRequest);
      
      // Assert
      expect(result.status).toBe(400);
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(false);
      expect(bodyJson.error).toContain('User ID is required');
    });
  });

  describe('getAllOrganizations', () => {
    it('should return all organizations', async () => {
      // Setup
      const mockOrgs = {
        results: [
          { orgID: 1, name: 'Org 1', description: 'Desc 1', memberCount: 5 },
          { orgID: 2, name: 'Org 2', description: 'Desc 2', memberCount: 10 }
        ]
      };
      
      mockBackendService.queryAll.mockResolvedValue(mockOrgs);
      
      // Execute
      const result = await orgController.getAllOrganizations({});
      
      // Assert
      expect(mockBackendService.queryAll).toHaveBeenCalledWith(
        expect.stringContaining("SELECT o.*, COUNT(om.userID) as memberCount")
      );
      
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(true);
      expect(bodyJson.organizations).toEqual(mockOrgs.results);
    });
    
    it('should handle empty organizations list', async () => {
      // Setup - empty results
      mockBackendService.queryAll.mockResolvedValue({ results: [] });
      
      // Execute
      const result = await orgController.getAllOrganizations({});
      
      // Assert
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(true);
      expect(bodyJson.organizations).toEqual([]);
    });
    
    it('should handle database errors', async () => {
      // Setup - simulate DB error
      mockBackendService.queryAll.mockRejectedValue(new Error('Database error'));
      
      // Execute
      const result = await orgController.getAllOrganizations({});
      
      // Assert
      expect(result.status).toBe(500);
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(false);
      expect(bodyJson.error).toContain('Database error');
    });
  });

  describe('getOrganization', () => {
    it('should return a specific organization with admins', async () => {
      // Setup
      const orgId = 1;
      const mockOrg = {
        orgID: 1,
        name: 'Test Organization',
        description: 'Test Description',
        memberCount: 10
      };
      
      const mockAdmins = {
        results: [
          { id: 1, email: 'admin1@example.com', firstName: 'Admin', lastName: 'One' },
          { id: 2, email: 'admin2@example.com', firstName: 'Admin', lastName: 'Two' }
        ]
      };
      
      mockBackendService.queryFirst.mockResolvedValue(mockOrg);
      mockBackendService.queryAll.mockResolvedValue(mockAdmins);
      
      // Execute
      const result = await orgController.getOrganization(orgId);
      
      // Assert
      expect(mockBackendService.queryFirst).toHaveBeenCalledWith(
        expect.stringContaining("WHERE o.orgID = ?"),
        [orgId]
      );
      
      expect(mockBackendService.queryAll).toHaveBeenCalledWith(
        expect.stringContaining("FROM ORG_ADMIN"),
        [orgId]
      );
      
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(true);
      expect(bodyJson.organization.orgID).toBe(1);
      expect(bodyJson.organization.admins).toEqual(mockAdmins.results);
    });
    
    it('should return 404 when organization not found', async () => {
      // Setup
      const orgId = 999; // Non-existent organization
      mockBackendService.queryFirst.mockResolvedValue(null);
      
      // Execute
      const result = await orgController.getOrganization(orgId);
      
      // Assert
      expect(result.status).toBe(404);
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(false);
      expect(bodyJson.error).toContain('not found');
    });
  });

  describe('getOrganizationEvents', () => {
    it('should return events for a specific organization', async () => {
      // Setup
      const orgId = 1;
      const mockEvents = {
        results: [
          { eventID: 1, title: 'Event 1', startDate: '2023-06-01', endDate: '2023-06-02' },
          { eventID: 2, title: 'Event 2', startDate: '2023-07-01', endDate: '2023-07-02' }
        ]
      };
      
      mockBackendService.queryAll.mockResolvedValue(mockEvents);
      
      // Execute
      const result = await orgController.getOrganizationEvents(orgId);
      
      // Assert
      expect(mockBackendService.queryAll).toHaveBeenCalledWith(
        expect.stringContaining("WHERE e.organizationID = ?"),
        [orgId]
      );
      
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(true);
      expect(bodyJson.events).toEqual(mockEvents.results);
    });
    
    it('should return empty array when no events are found', async () => {
      // Setup
      const orgId = 1;
      mockBackendService.queryAll.mockResolvedValue({ results: [] });
      
      // Execute
      const result = await orgController.getOrganizationEvents(orgId);
      
      // Assert
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(true);
      expect(bodyJson.events).toEqual([]);
    });
    
    it('should handle database errors', async () => {
      // Setup
      const orgId = 1;
      mockBackendService.queryAll.mockRejectedValue(new Error('Database query failed'));
      
      // Execute
      const result = await orgController.getOrganizationEvents(orgId);
      
      // Assert
      expect(result.status).toBe(500);
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(false);
      expect(bodyJson.error).toContain('Database query failed');
    });
  });
});