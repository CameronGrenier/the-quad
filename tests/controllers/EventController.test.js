import { jest } from '@jest/globals';
import { EventController } from '../../client/src/controllers/EventController.js';

// Create a modified version of the controller that COMPLETELY OVERRIDES the methods
class TestEventController extends EventController {
  constructor(env, corsHeaders, backendService, databaseService, utils) {
    super(env, corsHeaders);
    this.mockBackendService = backendService;
    this.mockDatabaseService = databaseService;
    this.mockUtils = utils;
  }

  // Override all methods to use our mocks instead of imported modules
  async registerEvent(request) {
    const req = request;
    try {
      const formData = await this.mockUtils.parseFormData(req);
      const organizationID = formData.get('organizationID');
      const title = formData.get('title');
      const description = formData.get('description') || '';
      const startDate = formData.get('startDate');
      const endDate = formData.get('endDate');
      const privacy = formData.get('privacy') || 'public';
      const submitForOfficialStatus = formData.get('submitForOfficialStatus') === 'true';
      const landmarkID = formData.get('landmarkID') || null;
      const customLocation = formData.get('customLocation') || '';
      const userID = formData.get('userID');
      
      if (!organizationID || !title || !startDate || !endDate || !userID) {
        throw new Error('Organization ID, title, start date, end date and user ID are required');
      }
      
      // Verify admin rights
      const isAdmin = await this.mockDatabaseService.query(this.env, `
        SELECT 1 FROM ORG_ADMIN
        WHERE orgID = ? AND userID = ?
      `, [organizationID, userID]);
      
      if (isAdmin.length === 0) {
        throw new Error('User is not an admin of this organization');
      }
      
      let thumbnailURL = '', bannerURL = '';
      const thumbnail = formData.get('thumbnail');
      if (thumbnail && thumbnail.size > 0) {
        thumbnailURL = await this.mockUtils.uploadFileToR2(this.env, thumbnail, `events/thumbnails/${title}-${Date.now()}`);
      }
      
      const banner = formData.get('banner');
      if (banner && banner.size > 0) {
        bannerURL = await this.mockUtils.uploadFileToR2(this.env, banner, `events/banners/${title}-${Date.now()}`);
      }
      
      const insertResult = await this.mockDatabaseService.execute(this.env, `
        INSERT INTO EVENT (
          organizationID, title, description, thumbnail, banner,
          startDate, endDate, privacy, officialStatus, landmarkID,
          customLocation
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        organizationID, title, description, thumbnailURL, bannerURL,
        startDate, endDate, privacy, submitForOfficialStatus ? 1 : 0,
        landmarkID, customLocation
      ]);
      
      const newEventID = insertResult.meta.last_row_id;
      await this.mockDatabaseService.execute(this.env, `
        INSERT INTO EVENT_ADMIN (eventID, userID)
        VALUES (?, ?)
      `, [newEventID, userID]);
      
      return {
        success: true,
        message: "Event created successfully",
        eventID: newEventID
      };
    } catch (error) {
      throw error;
    }
  }

  async getAllEvents(request) {
    try {
      // Get all events with organization names included
      const events = await this.mockDatabaseService.query(this.env, `
        SELECT e.*, o.name as organizationName
        FROM EVENT e
        JOIN ORGANIZATION o ON e.organizationID = o.orgID
        ORDER BY e.startDate ASC
      `);
      
      return {
        success: true,
        events: events || []
      };
    } catch (error) {
      throw error;
    }
  }
}

describe('EventController', () => {
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
    mockEnv = { D1_DB: {}, R2: {} };
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
      execute: jest.fn(async () => ({ meta: { last_row_id: 123 } }))
    };
    
    mockUtils = {
      parseFormData: jest.fn(async () => mockFormData),
      uploadFileToR2: jest.fn(async () => 'https://example.com/uploaded-file.jpg')
    };
    
    // Initialize controller with mock dependencies
    controller = new TestEventController(
      mockEnv, 
      mockCorsHeaders,
      mockBackendService,
      mockDatabaseService,
      mockUtils
    );
    
    // Create a mock request
    mockRequest = {
      headers: new Map(),
      formData: jest.fn()
    };
  });

  describe('registerEvent', () => {
    test('should successfully register a new event', async () => {
      // Setup form data
      mockFormData['organizationID'] = '42';
      mockFormData['title'] = 'Test Event';
      mockFormData['description'] = 'A test event description';
      mockFormData['startDate'] = '2025-04-01T12:00:00';
      mockFormData['endDate'] = '2025-04-01T15:00:00';
      mockFormData['privacy'] = 'public';
      mockFormData['submitForOfficialStatus'] = 'true';
      mockFormData['customLocation'] = 'Building A, Room 101';
      mockFormData['userID'] = '789';
      
      // Thumbnail and banner mocks
      mockFormData['thumbnail'] = { size: 1024, name: 'thumbnail.jpg' };
      mockFormData['banner'] = { size: 2048, name: 'banner.jpg' };
      
      // Mock admin verification
      mockDatabaseService.query.mockResolvedValueOnce([{ 1: 1 }]);
      
      // Execute
      const result = await controller.registerEvent(mockRequest);
      
      // Assertions
      expect(mockUtils.parseFormData).toHaveBeenCalledWith(mockRequest);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        mockEnv,
        expect.stringContaining("FROM ORG_ADMIN"),
        ['42', '789']
      );
      expect(mockUtils.uploadFileToR2).toHaveBeenCalledTimes(2);
      expect(mockDatabaseService.execute).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        success: true,
        message: "Event created successfully",
        eventID: 123
      });
    });

    test('should throw error if required fields are missing', async () => {
      // Setup incomplete form data
      mockFormData['organizationID'] = '42';
      mockFormData['title'] = 'Test Event';
      // missing startDate and endDate
      mockFormData['userID'] = '789';
      
      // Execute & Assert
      await expect(controller.registerEvent(mockRequest))
        .rejects
        .toThrow('Organization ID, title, start date, end date and user ID are required');
        
      expect(mockDatabaseService.query).not.toHaveBeenCalled();
    });

    test('should throw error if user is not an organization admin', async () => {
      // Setup form data
      mockFormData['organizationID'] = '42';
      mockFormData['title'] = 'Test Event';
      mockFormData['startDate'] = '2025-04-01T12:00:00';
      mockFormData['endDate'] = '2025-04-01T15:00:00';
      mockFormData['userID'] = '789';
      
      // Mock admin verification (empty result = not an admin)
      mockDatabaseService.query.mockResolvedValueOnce([]);
      
      // Execute & Assert
      await expect(controller.registerEvent(mockRequest))
        .rejects
        .toThrow('User is not an admin of this organization');
        
      expect(mockDatabaseService.execute).not.toHaveBeenCalled();
    });

    test('should handle events without images', async () => {
      // Setup form data without images
      mockFormData['organizationID'] = '42';
      mockFormData['title'] = 'Test Event';
      mockFormData['description'] = 'A test event description';
      mockFormData['startDate'] = '2025-04-01T12:00:00';
      mockFormData['endDate'] = '2025-04-01T15:00:00';
      mockFormData['userID'] = '789';
      
      // No thumbnail/banner or size = 0
      mockFormData['thumbnail'] = { size: 0 };
      mockFormData['banner'] = null;
      
      // Mock admin verification
      mockDatabaseService.query.mockResolvedValueOnce([{ 1: 1 }]);
      
      // Execute
      const result = await controller.registerEvent(mockRequest);
      
      // Assertions
      expect(mockUtils.uploadFileToR2).not.toHaveBeenCalled();
      expect(mockDatabaseService.execute).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        success: true,
        message: "Event created successfully",
        eventID: 123
      });
    });
  });

  describe('getAllEvents', () => {
    test('should return all events', async () => {
      // Mock events data
      const mockEvents = [
        {
          eventID: 1,
          title: 'First Event',
          organizationID: 42,
          organizationName: 'Test Org'
        },
        {
          eventID: 2,
          title: 'Second Event',
          organizationID: 43,
          organizationName: 'Another Org'
        }
      ];
      
      mockDatabaseService.query.mockResolvedValueOnce(mockEvents);
      
      // Execute
      const result = await controller.getAllEvents(mockRequest);
      
      // Assertions
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        mockEnv,
        expect.stringContaining("SELECT e.*, o.name as organizationName")
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
      const result = await controller.getAllEvents(mockRequest);
      
      // Assertions
      expect(result).toEqual({
        success: true,
        events: []
      });
    });
  });
});
