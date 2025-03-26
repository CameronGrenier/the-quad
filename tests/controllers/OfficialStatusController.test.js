import { OfficialStatusController } from '../../client/src/controllers/OfficialStatusController.js';

describe('OfficialStatusController', () => {
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
            run: jest.fn().mockResolvedValue({ success: true })
          }))
        }))
      }
    };
    
    controller = new OfficialStatusController(mockEnv, corsHeaders);
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('verifyOrganizationOfficialStatus', () => {
    test('should return true for official organization', async () => {
      // Mock the database to return an official org
      mockEnv.D1_DB.prepare = jest.fn(() => ({
        bind: jest.fn(() => ({
          first: jest.fn().mockResolvedValue({ orgID: 123 }),
          all: jest.fn(),
          run: jest.fn()
        }))
      }));
      
      const org = { orgID: 123 };
      const result = await controller.verifyOrganizationOfficialStatus(org);
      
      expect(result).toBe(true);
      expect(mockEnv.D1_DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM OFFICIAL_ORGS")
      );
    });
    
    test('should return false for non-official organization', async () => {
      // Mock the database to return null (no official org entry)
      mockEnv.D1_DB.prepare = jest.fn(() => ({
        bind: jest.fn(() => ({
          first: jest.fn().mockResolvedValue(null),
          all: jest.fn(),
          run: jest.fn()
        }))
      }));
      
      const org = { orgID: 456 };
      const result = await controller.verifyOrganizationOfficialStatus(org);
      
      expect(result).toBe(false);
    });
  });

  describe('verifyEventOfficialStatus', () => {
    test('should return true for official event', async () => {
      // Mock the database to return an official event
      mockEnv.D1_DB.prepare = jest.fn(() => ({
        bind: jest.fn(() => ({
          first: jest.fn().mockResolvedValue({ eventID: 789 }),
          all: jest.fn(),
          run: jest.fn()
        }))
      }));
      
      const event = { eventID: 789 };
      const result = await controller.verifyEventOfficialStatus(event);
      
      expect(result).toBe(true);
      expect(mockEnv.D1_DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM OFFICIAL_EVENTS")
      );
    });
    
    test('should return false for non-official event', async () => {
      // Mock the database to return null (no official event entry)
      mockEnv.D1_DB.prepare = jest.fn(() => ({
        bind: jest.fn(() => ({
          first: jest.fn().mockResolvedValue(null),
          all: jest.fn(),
          run: jest.fn()
        }))
      }));
      
      const event = { eventID: 101 };
      const result = await controller.verifyEventOfficialStatus(event);
      
      expect(result).toBe(false);
    });
  });

  describe('acceptOrganization', () => {
    test('should successfully accept an organization', async () => {
      const org = { orgID: 123 };
      const result = await controller.acceptOrganization(org);
      
      expect(result).toBe(true);
      expect(mockEnv.D1_DB.prepare).toHaveBeenCalledTimes(2);
      expect(mockEnv.D1_DB.prepare).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("INSERT INTO OFFICIAL_ORGS")
      );
      expect(mockEnv.D1_DB.prepare).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("DELETE FROM PENDING_SUBMISSION")
      );
    });
  });

  describe('acceptEvent', () => {
    test('should successfully accept an event', async () => {
      const event = { eventID: 789 };
      const result = await controller.acceptEvent(event);
      
      expect(result).toBe(true);
      expect(mockEnv.D1_DB.prepare).toHaveBeenCalledTimes(2);
      expect(mockEnv.D1_DB.prepare).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("INSERT INTO OFFICIAL_EVENTS")
      );
      expect(mockEnv.D1_DB.prepare).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("DELETE FROM PENDING_SUBMISSION")
      );
    });
  });

  describe('denySubmission', () => {
    test('should successfully deny an organization submission', async () => {
      const item = { orgID: 123 };
      const result = await controller.denySubmission(item);
      
      expect(result).toBe(true);
      expect(mockEnv.D1_DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM PENDING_SUBMISSION")
      );
    });
    
    test('should successfully deny an event submission', async () => {
      const item = { eventID: 789 };
      const result = await controller.denySubmission(item);
      
      expect(result).toBe(true);
      expect(mockEnv.D1_DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM PENDING_SUBMISSION")
      );
    });
  });
});