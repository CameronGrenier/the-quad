import { AdminDashboard } from '../../client/src/controllers/AdminDashboardController.js';
import * as authUtils from '../../client/src/utils/auth.js';
import { OfficialStatusController } from '../../client/src/controllers/OfficialStatusController.js';

// Mock OfficialStatusController
jest.mock('../../client/src/controllers/OfficialStatusController.js');

describe('AdminDashboard', () => {
  let dashboard;
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
            run: jest.fn().mockResolvedValue({ success: true })
          }))
        }))
      }
    };
    
    dashboard = new AdminDashboard(mockEnv, corsHeaders);
    
    // Mock auth utilities
    jest.spyOn(authUtils, 'verifyJWT').mockReturnValue({ userId: 999, email: 'admin@example.com' });
    
    // Reset and mock the OfficialStatusController implementation
    OfficialStatusController.mockClear();
    OfficialStatusController.mockImplementation(() => ({
      acceptOrganization: jest.fn().mockResolvedValue(true),
      acceptEvent: jest.fn().mockResolvedValue(true),
      denySubmission: jest.fn().mockResolvedValue(true)
    }));
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('displayPendingSubmissions', () => {
    test('should return pending organizations and events', async () => {
      // Mock the DB to return pending submissions
      mockEnv.D1_DB.prepare = jest.fn()
        .mockImplementationOnce(() => ({
          all: jest.fn().mockResolvedValue({ 
            results: [
              { submissionID: 1, orgID: 123, name: 'Pending Org' }
            ] 
          })
        }))
        .mockImplementationOnce(() => ({
          all: jest.fn().mockResolvedValue({ 
            results: [
              { submissionID: 2, eventID: 456, title: 'Pending Event' }
            ] 
          })
        }));
      
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('Bearer valid_token')
        }
      };
      
      const response = await dashboard.displayPendingSubmissions(mockRequest);
      const responseData = await response.json();
      
      expect(responseData.success).toBe(true);
      expect(responseData.pendingOrganizations).toHaveLength(1);
      expect(responseData.pendingEvents).toHaveLength(1);
      expect(responseData.pendingOrganizations[0].name).toBe('Pending Org');
      expect(responseData.pendingEvents[0].title).toBe('Pending Event');
      expect(authUtils.verifyJWT).toHaveBeenCalledWith('valid_token');
    });
    
    test('should return error when no token provided', async () => {
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue('')
        }
      };
      
      const response = await dashboard.displayPendingSubmissions(mockRequest);
      const responseData = await response.json();
      
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Authentication token required');
      expect(response.status).toBe(401);
    });
  });

  describe('reviewSubmission', () => {
    test('should return organization submission details', async () => {
      // Mock the DB to return a submission and org details
      mockEnv.D1_DB.prepare = jest.fn()
        .mockImplementationOnce(() => ({
          bind: jest.fn(() => ({
            first: jest.fn().mockResolvedValue({ 
              submissionID: 1, 
              orgID: 123, 
              eventID: null 
            })
          }))
        }))
        .mockImplementationOnce(() => ({
          bind: jest.fn(() => ({
            first: jest.fn().mockResolvedValue({ 
              orgID: 123, 
              name: 'Test Org', 
              description: 'Test Description' 
            })
          }))
        }));
      
      const response = await dashboard.reviewSubmission(1);
      const responseData = await response.json();
      
      expect(responseData.success).toBe(true);
      expect(responseData.submission.details.type).toBe('organization');
      expect(responseData.submission.details.name).toBe('Test Org');
    });
    
    test('should return event submission details', async () => {
      // Mock the DB to return a submission and event details
      mockEnv.D1_DB.prepare = jest.fn()
        .mockImplementationOnce(() => ({
          bind: jest.fn(() => ({
            first: jest.fn().mockResolvedValue({ 
              submissionID: 2, 
              orgID: null, 
              eventID: 456 
            })
          }))
        }))
        .mockImplementationOnce(() => ({
          bind: jest.fn(() => ({
            first: jest.fn().mockResolvedValue({ 
              eventID: 456, 
              title: 'Test Event', 
              description: 'Event Description' 
            })
          }))
        }));
      
      const response = await dashboard.reviewSubmission(2);
      const responseData = await response.json();
      
      expect(responseData.success).toBe(true);
      expect(responseData.submission.details.type).toBe('event');
      expect(responseData.submission.details.title).toBe('Test Event');
    });
    
    test('should return 404 if submission not found', async () => {
      // Mock the DB to return null (no submission)
      mockEnv.D1_DB.prepare = jest.fn(() => ({
        bind: jest.fn(() => ({
          first: jest.fn().mockResolvedValue(null)
        }))
      }));
      
      const response = await dashboard.reviewSubmission(999);
      const responseData = await response.json();
      
      expect(responseData.success).toBe(false);
      expect(responseData.error).toBe('Submission not found');
      expect(response.status).toBe(404);
    });
  });

  describe('processDecision', () => {
    test('should approve organization submission', async () => {
      // Mock the DB to return an org submission
      mockEnv.D1_DB.prepare = jest.fn(() => ({
        bind: jest.fn(() => ({
          first: jest.fn().mockResolvedValue({ 
            submissionID: 1, 
            orgID: 123, 
            eventID: null 
          })
        }))
      }));
      
      const mockRequest = {
        json: jest.fn().mockResolvedValue({
          submissionID: 1,
          approved: true
        })
      };
      
      const response = await dashboard.processDecision(mockRequest);
      const responseData = await response.json();
      
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Submission approved');
      
      // Check if acceptOrganization was called
      const officialStatusInstance = OfficialStatusController.mock.instances[0];
      expect(officialStatusInstance.acceptOrganization).toHaveBeenCalled();
      expect(officialStatusInstance.acceptOrganization).toHaveBeenCalledWith({ orgID: 123 });
    });
    
    test('should approve event submission', async () => {
      // Mock the DB to return an event submission
      mockEnv.D1_DB.prepare = jest.fn(() => ({
        bind: jest.fn(() => ({
          first: jest.fn().mockResolvedValue({ 
            submissionID: 2, 
            orgID: null, 
            eventID: 456
          })
        }))
      }));
      
      const mockRequest = {
        json: jest.fn().mockResolvedValue({
          submissionID: 2,
          approved: true
        })
      };
      
      const response = await dashboard.processDecision(mockRequest);
      const responseData = await response.json();
      
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Submission approved');
      
      // Check if acceptEvent was called
      const officialStatusInstance = OfficialStatusController.mock.instances[0];
      expect(officialStatusInstance.acceptEvent).toHaveBeenCalled();
      expect(officialStatusInstance.acceptEvent).toHaveBeenCalledWith({ eventID: 456 });
    });
    
    test('should deny submission', async () => {
      // Mock the DB to return a submission
      mockEnv.D1_DB.prepare = jest.fn(() => ({
        bind: jest.fn(() => ({
          first: jest.fn().mockResolvedValue({ 
            submissionID: 3, 
            orgID: 789, 
            eventID: null 
          })
        }))
      }));
      
      const mockRequest = {
        json: jest.fn().mockResolvedValue({
          submissionID: 3,
          approved: false
        })
      };
      
      const response = await dashboard.processDecision(mockRequest);
      const responseData = await response.json();
      
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Submission rejected');
      
      // Check if denySubmission was called
      const officialStatusInstance = OfficialStatusController.mock.instances[0];
      expect(officialStatusInstance.denySubmission).toHaveBeenCalled();
      expect(officialStatusInstance.denySubmission).toHaveBeenCalledWith({ 
        submissionID: 3, 
        orgID: 789, 
        eventID: null 
      });
    });
  });
});