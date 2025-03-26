import { EventController } from '../../client/src/controllers/EventController.js';
import * as formDataUtils from '../../client/src/utils/formData.js';
import * as storageUtils from '../../client/src/utils/storage.js';
import * as authUtils from '../../client/src/utils/auth.js';

describe('EventController', () => {
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
            first: jest.fn().mockResolvedValue({ 
              orgID: 1, 
              multiEventAllowed: true 
            }),
            all: jest.fn().mockResolvedValue({ results: [] }),
            run: jest.fn().mockResolvedValue({ meta: { last_row_id: 789 } })
          }))
        }))
      }
    };
    
    controller = new EventController(mockEnv, corsHeaders);
    
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
    
    jest.spyOn(storageUtils, 'uploadFileToR2')
      .mockResolvedValueOnce('/images/event_thumb_123.jpg')
      .mockResolvedValueOnce('/images/event_banner_123.jpg');
      
    jest.spyOn(authUtils, 'verifyJWT').mockReturnValue({ userId: 123, email: 'test@example.com' });
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('registerEvent', () => {
    test('should create a new event successfully', async () => {
      // Mock the isAdmin check
      mockEnv.D1_DB.prepare = jest.fn(() => ({
        bind: jest.fn(() => ({
          first: jest.fn().mockResolvedValue({ orgID: 1, userID: 123 }),
          all: jest.fn().mockResolvedValue({ results: [] }),
          run: jest.fn().mockResolvedValue({ meta: { last_row_id: 789 } })
        }))
      }));
      
      const mockFormData = {
        title: 'Test Event',
        description: 'Test Description',
        organizationID: '1',
        startDate: '2025-06-01T12:00:00.000Z',
        endDate: '2025-06-01T14:00:00.000Z',
        privacy: 'public',
        landmarkID: '42',
        thumbnail: new File(['test'], 'thumbnail.jpg', { type: 'image/jpeg' }),
        banner: new File(['test'], 'banner.jpg', { type: 'image/jpeg' })
      };
      
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Bearer valid_token')
        },
        formData: jest.fn().mockResolvedValue(mockFormData)
      };
      
      const response = await controller.registerEvent(mockRequest);
      const responseData = await response.json();
      
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Event created successfully');
      expect(responseData.eventID).toBe(789);
      expect(authUtils.verifyJWT).toHaveBeenCalledWith('valid_token');
    });
    
    test('should return error when user is not an admin of the organization', async () => {
      // Mock the isAdmin check to return null (no admin record)
      mockEnv.D1_DB.prepare = jest.fn(() => ({
        bind: jest.fn(() => ({
          first: jest.fn().mockResolvedValue(null),
          all: jest.fn(),
          run: jest.fn()
        }))
      }));
      
      const mockFormData = {
        title: 'Test Event',
        description: 'Test Description',
        organizationID: '1',
        startDate: '2025-06-01T12:00:00.000Z',
        endDate: '2025-06-01T14:00:00.000Z'
      };
      
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Bearer valid_token')
        },
        formData: jest.fn().mockResolvedValue(mockFormData)
      };
      
      const response = await controller.registerEvent(mockRequest);
      const responseData = await response.json();
      
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain("You don't have permission");
      expect(response.status).toBe(403);
    });
    
    test('should return error when landmark is already booked', async () => {
      // First mock the isAdmin check to return true
      mockEnv.D1_DB.prepare = jest.fn()
        .mockImplementationOnce(() => ({
          bind: jest.fn(() => ({
            first: jest.fn().mockResolvedValue({ orgID: 1, userID: 123 }),
            all: jest.fn(),
            run: jest.fn()
          }))
        }))
        // Then mock the landmark lookup
        .mockImplementationOnce(() => ({
          bind: jest.fn(() => ({
            first: jest.fn().mockResolvedValue({ 
              landmarkID: 42, 
              name: 'Test Landmark', 
              multiEventAllowed: false 
            }),
            all: jest.fn(),
            run: jest.fn()
          }))
        }))
        // Then mock the conflicting events check
        .mockImplementationOnce(() => ({
          bind: jest.fn(() => ({
            all: jest.fn().mockResolvedValue({ 
              results: [
                { eventID: 100, title: 'Conflicting Event' }
              ] 
            }),
            first: jest.fn(),
            run: jest.fn()
          }))
        }));
      
      const mockFormData = {
        title: 'Test Event',
        description: 'Test Description',
        organizationID: '1',
        startDate: '2025-06-01T12:00:00.000Z',
        endDate: '2025-06-01T14:00:00.000Z',
        landmarkID: '42'
      };
      
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Bearer valid_token')
        },
        formData: jest.fn().mockResolvedValue(mockFormData)
      };
      
      const response = await controller.registerEvent(mockRequest);
      const responseData = await response.json();
      
      expect(responseData.success).toBe(false);
      expect(responseData.error).toContain('Landmark is already booked');
      expect(response.status).toBe(400);
    });
  });
});