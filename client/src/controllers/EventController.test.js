import EventController from './EventController';

// Mock dependencies
jest.mock('../utils/formData.js', () => ({
  parseFormData: jest.fn()
}));

describe('EventController', () => {
  let eventController;
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
    
    eventController = new EventController(
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

  describe('registerEvent', () => {
    it('should create an event successfully', async () => {
      // Setup mock form data
      const mockFormData = new FormData();
      mockFormData.append('organizationID', '1');
      mockFormData.append('title', 'Test Event');
      mockFormData.append('description', 'Test Event Description');
      mockFormData.append('startDate', '2023-06-01T12:00');
      mockFormData.append('endDate', '2023-06-01T14:00');
      mockFormData.append('privacy', 'public');
      mockFormData.append('userID', '1');
      
      formDataUtil.parseFormData.mockResolvedValue(mockFormData);
      
      // User is admin of organization
      mockBackendService.queryFirst.mockResolvedValue({ '1': 1 });
      
      const mockRequest = {};
      
      // Execute
      const result = await eventController.registerEvent(mockRequest);
      
      // Assert
      expect(mockBackendService.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO EVENT"),
        expect.arrayContaining(['1', 'Test Event', 'Test Event Description'])
      );
      
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(true);
      expect(bodyJson.message).toBe('Event created successfully');
      expect(bodyJson.eventID).toBe(1);
    });
    
    it('should return error for missing required fields', async () => {
      // Setup mock form data with missing fields
      const mockFormData = new FormData();
      mockFormData.append('organizationID', '1');
      mockFormData.append('title', 'Test Event');
      // Missing startDate, endDate
      mockFormData.append('userID', '1');
      
      formDataUtil.parseFormData.mockResolvedValue(mockFormData);
      
      const mockRequest = {};
      
      // Execute
      const result = await eventController.registerEvent(mockRequest);
      
      // Assert
      expect(result.status).toBe(400);
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(false);
      expect(bodyJson.error).toContain('required');
    });
    
    it('should return error if user is not an admin of the organization', async () => {
      // Setup mock form data
      const mockFormData = new FormData();
      mockFormData.append('organizationID', '1');
      mockFormData.append('title', 'Test Event');
      mockFormData.append('startDate', '2023-06-01T12:00');
      mockFormData.append('endDate', '2023-06-01T14:00');
      mockFormData.append('userID', '1');
      
      formDataUtil.parseFormData.mockResolvedValue(mockFormData);
      
      // User is not admin of organization
      mockBackendService.queryFirst.mockResolvedValue(null);
      
      const mockRequest = {};
      
      // Execute
      const result = await eventController.registerEvent(mockRequest);
      
      // Assert
      expect(result.status).toBe(403);
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(false);
      expect(bodyJson.error).toContain('not an admin');
    });
    
    it('should handle file uploads correctly', async () => {
      // Setup mock form data with files
      const mockFormData = new FormData();
      mockFormData.append('organizationID', '1');
      mockFormData.append('title', 'Test Event');
      mockFormData.append('description', 'Test Event Description');
      mockFormData.append('startDate', '2023-06-01T12:00');
      mockFormData.append('endDate', '2023-06-01T14:00');
      mockFormData.append('userID', '1');
      
      // Add mock files
      const thumbnail = { size: 1024, name: 'thumbnail.jpg' };
      const banner = { size: 2048, name: 'banner.jpg' };
      mockFormData.append('thumbnail', thumbnail);
      mockFormData.append('banner', banner);
      
      formDataUtil.parseFormData.mockResolvedValue(mockFormData);
      
      // User is admin of organization
      mockBackendService.queryFirst.mockResolvedValue({ '1': 1 });
      
      mockBackendService.uploadFile
        .mockResolvedValueOnce('/images/thumbnails/test.jpg') // For thumbnail
        .mockResolvedValueOnce('/images/banners/test.jpg');   // For banner
      
      const mockRequest = {};
      
      // Execute
      const result = await eventController.registerEvent(mockRequest);
      
      // Assert
      expect(mockBackendService.uploadFile).toHaveBeenCalledTimes(2);
      expect(mockBackendService.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO EVENT"),
        expect.arrayContaining([
          '1', 
          'Test Event', 
          'Test Event Description', 
          '/images/thumbnails/test.jpg', 
          '/images/banners/test.jpg'
        ])
      );
      
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(true);
      expect(bodyJson.eventID).toBe(1);
    });
  });
});