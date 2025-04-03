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

  describe('getAllEvents', () => {
    it('should return a list of events', async () => {
      // Mock the database response
      const mockEvents = {
        results: [
          { eventID: 1, title: 'Test Event 1', organizationName: 'Org 1' },
          { eventID: 2, title: 'Test Event 2', organizationName: 'Org 2' }
        ]
      };
      
      mockBackendService.queryAll.mockResolvedValue(mockEvents);
      
      // Create mock request with URL
      const mockRequest = {
        url: 'https://example.com/api/events'
      };
      
      // Execute
      const result = await eventController.getAllEvents(mockRequest);
      
      // Assert
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(true);
      expect(bodyJson.events).toEqual(mockEvents.results);
      expect(mockBackendService.queryAll).toHaveBeenCalled();
    });
  });

  describe('getEventById', () => {
    it('should return a specific event by ID', async () => {
      // Mock the database response
      const mockEvent = { 
        eventID: 1, 
        title: 'Test Event', 
        organizationName: 'Test Org',
        landmarkID: 5
      };
      
      const mockLandmark = {
        name: 'Test Landmark'
      };
      
      mockBackendService.queryFirst
        .mockResolvedValueOnce(mockEvent)
        .mockResolvedValueOnce(mockLandmark);
      
      // Execute
      const result = await eventController.getEventById(1);
      
      // Assert
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(true);
      expect(bodyJson.event.eventID).toBe(1);
      expect(bodyJson.event.landmarkName).toBe('Test Landmark');
      expect(mockBackendService.queryFirst).toHaveBeenCalledTimes(2);
    });
    
    it('should return 404 when event is not found', async () => {
      // Mock the database response for a non-existent event
      mockBackendService.queryFirst.mockResolvedValue(null);
      
      // Execute
      const result = await eventController.getEventById(999);
      
      // Assert
      expect(result.status).toBe(404);
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(false);
      expect(bodyJson.error).toContain('not found');
    });
  });

  describe('handleEventRSVP', () => {
    it('should create a new RSVP', async () => {
      // Mock request with auth and body
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Bearer mock-token')
        },
        json: jest.fn().mockResolvedValue({ rsvpStatus: 'attending' })
      };
      
      // Event exists
      mockBackendService.queryFirst
        .mockResolvedValueOnce({ eventID: 1 }) // Event lookup
        .mockResolvedValueOnce(null);          // No existing RSVP
      
      // Execute
      const result = await eventController.handleEventRSVP(1, mockRequest);
      
      // Assert
      expect(mockBackendService.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO EVENT_RSVP"),
        [1, 1, 'attending']
      );
      
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(true);
      expect(bodyJson.rsvpStatus).toBe('attending');
    });
    
    it('should update an existing RSVP', async () => {
      // Mock request with auth and body
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Bearer mock-token')
        },
        json: jest.fn().mockResolvedValue({ rsvpStatus: 'maybe' })
      };
      
      // Event and RSVP exist
      mockBackendService.queryFirst
        .mockResolvedValueOnce({ eventID: 1 })                    // Event lookup
        .mockResolvedValueOnce({ eventID: 1, userID: 1 });  // Existing RSVP
      
      // Execute
      const result = await eventController.handleEventRSVP(1, mockRequest);
      
      // Assert
      expect(mockBackendService.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE EVENT_RSVP SET rsvpStatus"),
        ['maybe', 1, 1]
      );
      
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(true);
      expect(bodyJson.message).toContain('updated');
    });
    
    it('should return 404 for non-existent event', async () => {
      // Mock request with auth and body
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Bearer mock-token')
        },
        json: jest.fn().mockResolvedValue({ rsvpStatus: 'attending' })
      };
      
      // Event doesn't exist
      mockBackendService.queryFirst.mockResolvedValue(null);
      
      // Execute
      const result = await eventController.handleEventRSVP(999, mockRequest);
      
      // Assert
      expect(result.status).toBe(404);
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(false);
      expect(bodyJson.error).toContain('not found');
    });
  });

  describe('getRSVPStatus', () => {
    it('should return the current RSVP status', async () => {
      // Mock request with auth
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Bearer mock-token')
        }
      };
      
      // RSVP exists
      mockBackendService.queryFirst.mockResolvedValue({ rsvpStatus: 'attending' });
      
      // Execute
      const result = await eventController.getRSVPStatus(1, mockRequest);
      
      // Assert
      expect(mockBackendService.queryFirst).toHaveBeenCalledWith(
        expect.stringContaining("SELECT rsvpStatus FROM EVENT_RSVP"),
        [1, 1]
      );
      
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(true);
      expect(bodyJson.rsvpStatus).toBe('attending');
    });
    
    it('should return null status when no RSVP exists', async () => {
      // Mock request with auth
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Bearer mock-token')
        }
      };
      
      // No RSVP exists
      mockBackendService.queryFirst.mockResolvedValue(null);
      
      // Execute
      const result = await eventController.getRSVPStatus(1, mockRequest);
      
      // Assert
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(true);
      expect(bodyJson.rsvpStatus).toBe(null);
    });
  });

  describe('getUserEvents', () => {
    it('should return combined admin and RSVP events for a user', async () => {
      // Mock request with auth
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Bearer mock-token')
        }
      };
      
      // Mock admin events
      const mockAdminEvents = {
        results: [
          { 
            eventID: 1, 
            title: 'Admin Event 1', 
            organizationName: 'Org 1',
            startDate: '2023-06-01',
            endDate: '2023-06-02',
            role: 'admin'
          },
          {
            eventID: 2, 
            title: 'Admin Event 2', 
            organizationName: 'Org 1',
            startDate: '2023-07-01',
            endDate: '2023-07-02', 
            role: 'admin'
          }
        ]
      };
      
      // Mock RSVP events
      const mockRsvpEvents = {
        results: [
          {
            eventID: 3, 
            title: 'RSVP Event', 
            organizationName: 'Org 2',
            startDate: '2023-08-01',
            endDate: '2023-08-02',
            role: 'attending'
          },
          // Include an event the user is both admin of and RSVP'd to
          {
            eventID: 1, 
            title: 'Admin Event 1', 
            organizationName: 'Org 1',
            startDate: '2023-06-01',
            endDate: '2023-06-02',
            role: 'attending'
          }
        ]
      };
      
      // Set up mock responses
      mockBackendService.queryAll
        .mockResolvedValueOnce(mockAdminEvents) // Admin events query
        .mockResolvedValueOnce(mockRsvpEvents); // RSVP events query
      
      // Execute
      const result = await eventController.getUserEvents(mockRequest);
      
      // Assert
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(true);
      
      // Should have 3 unique events (with no duplicates)
      expect(bodyJson.events.length).toBe(3);
      
      // Admin role should take precedence for event 1
      const event1 = bodyJson.events.find(e => e.eventID === 1);
      expect(event1.role).toBe('admin');
      
      // Check that RSVP event is included
      const event3 = bodyJson.events.find(e => e.eventID === 3);
      expect(event3.role).toBe('attending');
      
      // Verify both queries were called with the right user ID
      expect(mockBackendService.queryAll).toHaveBeenCalledWith(
        expect.stringContaining("JOIN EVENT_ADMIN"),
        [1]
      );
      expect(mockBackendService.queryAll).toHaveBeenCalledWith(
        expect.stringContaining("JOIN EVENT_RSVP"),
        [1]
      );
    });
    
    it('should return empty array when user has no events', async () => {
      // Mock request with auth
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Bearer mock-token')
        }
      };
      
      // User has no events
      mockBackendService.queryAll
        .mockResolvedValueOnce({ results: [] })
        .mockResolvedValueOnce({ results: [] });
      
      // Execute
      const result = await eventController.getUserEvents(mockRequest);
      
      // Assert
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(true);
      expect(bodyJson.events).toEqual([]);
    });
    
    it('should return 401 when authorization is missing', async () => {
      // Mock request without auth token
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('')
        }
      };
      
      // Execute
      const result = await eventController.getUserEvents(mockRequest);
      
      // Assert
      expect(result.status).toBe(401);
      const bodyJson = JSON.parse(result.body);
      expect(bodyJson.success).toBe(false);
      expect(bodyJson.error).toContain('Authentication required');
    });
  });
});