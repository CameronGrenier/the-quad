import AdminController from './AdminController';

describe('AdminController', () => {
  // Mock dependencies
  let mockEnv;
  let mockCorsHeaders;
  let mockBackendService;
  let mockAuth;
  let adminController;

  // Setup before each test
  beforeEach(() => {
    mockEnv = {};
    mockCorsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    };
    mockBackendService = {
      query: jest.fn(),
      queryFirst: jest.fn()
    };
    mockAuth = {
      getAuthFromRequest: jest.fn()
    };
    
    adminController = new AdminController(
      mockEnv,
      mockCorsHeaders,
      mockBackendService,
      mockAuth
    );
    
    // Setup fetch mock for Response
    global.Response = jest.fn().mockImplementation((body, options) => ({
      body,
      options,
      json: async () => JSON.parse(body)
    }));
  });

  // Helper function to create a mock request
  const createMockRequest = (body = {}) => ({
    json: jest.fn().mockResolvedValue(body)
  });

  describe('testStaff', () => {
    it('should return 401 if not authenticated', async () => {
      // Arrange
      mockAuth.getAuthFromRequest.mockReturnValue({ isAuthenticated: false });
      const request = createMockRequest();
      
      // Act
      const response = await adminController.testStaff(request);
      const jsonResponse = await response.json();
      
      // Assert
      expect(response.options.status).toBe(401);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBe('Authentication required');
    });

    it('should return staff status if authenticated', async () => {
      // Arrange
      mockAuth.getAuthFromRequest.mockReturnValue({ isAuthenticated: true, userId: '123' });
      mockBackendService.queryFirst.mockResolvedValue({ userID: '123', role: 'admin' });
      const request = createMockRequest();
      
      // Act
      const response = await adminController.testStaff(request);
      const jsonResponse = await response.json();
      
      // Assert
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.userId).toBe('123');
      expect(jsonResponse.isInStaffTable).toBe(true);
      expect(mockBackendService.queryFirst).toHaveBeenCalledWith(
        "SELECT * FROM STAFF WHERE userID = ?",
        ['123']
      );
    });
  });

  describe('getPendingRequests', () => {
    it('should return 401 if not authenticated', async () => {
      // Arrange
      mockAuth.getAuthFromRequest.mockReturnValue({ isAuthenticated: false });
      const request = createMockRequest();
      
      // Act
      const response = await adminController.getPendingRequests(request);
      const jsonResponse = await response.json();
      
      // Assert
      expect(response.options.status).toBe(401);
      expect(jsonResponse.success).toBe(false);
    });

    it('should return 403 if not staff', async () => {
      // Arrange
      mockAuth.getAuthFromRequest.mockReturnValue({ isAuthenticated: true, userId: '123' });
      mockBackendService.queryFirst.mockResolvedValue(null); // Not in staff table
      const request = createMockRequest();
      
      // Act
      const response = await adminController.getPendingRequests(request);
      const jsonResponse = await response.json();
      
      // Assert
      expect(response.options.status).toBe(403);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBe('Staff access required');
    });

    it('should return pending requests if staff', async () => {
      // Arrange
      mockAuth.getAuthFromRequest.mockReturnValue({ isAuthenticated: true, userId: '123' });
      mockBackendService.queryFirst.mockResolvedValue({ userID: '123' }); // In staff table
      mockBackendService.query
        .mockResolvedValueOnce({ results: [{ orgID: '1', name: 'Org 1' }] }) // For pending orgs
        .mockResolvedValueOnce({ results: [{ eventID: '1', title: 'Event 1' }] }); // For pending events
      const request = createMockRequest();
      
      // Act
      const response = await adminController.getPendingRequests(request);
      const jsonResponse = await response.json();
      
      // Assert
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.pendingOrganizations).toEqual([{ orgID: '1', name: 'Org 1' }]);
      expect(jsonResponse.pendingEvents).toEqual([{ eventID: '1', title: 'Event 1' }]);
    });
  });

  describe('getOrganizationDetails', () => {
    it('should return 401 if not authenticated', async () => {
      // Arrange
      mockAuth.getAuthFromRequest.mockReturnValue({ isAuthenticated: false });
      const request = createMockRequest();
      
      // Act
      const response = await adminController.getOrganizationDetails(request, '1');
      const jsonResponse = await response.json();
      
      // Assert
      expect(response.options.status).toBe(401);
      expect(jsonResponse.success).toBe(false);
    });

    it('should return 403 if not staff', async () => {
      // Arrange
      mockAuth.getAuthFromRequest.mockReturnValue({ isAuthenticated: true, userId: '123' });
      mockBackendService.queryFirst.mockResolvedValue(null); // Not in staff table
      const request = createMockRequest();
      
      // Act
      const response = await adminController.getOrganizationDetails(request, '1');
      const jsonResponse = await response.json();
      
      // Assert
      expect(response.options.status).toBe(403);
      expect(jsonResponse.success).toBe(false);
    });

    it('should return 404 if organization not found', async () => {
      // Arrange
      mockAuth.getAuthFromRequest.mockReturnValue({ isAuthenticated: true, userId: '123' });
      mockBackendService.queryFirst
        .mockResolvedValueOnce({ userID: '123' }) // In staff table
        .mockResolvedValueOnce(null); // Organization not found
      const request = createMockRequest();
      
      // Act
      const response = await adminController.getOrganizationDetails(request, '1');
      const jsonResponse = await response.json();
      
      // Assert
      expect(response.options.status).toBe(404);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBe('Organization not found');
    });

    it('should return organization details if authorized', async () => {
      // Arrange
      mockAuth.getAuthFromRequest.mockReturnValue({ isAuthenticated: true, userId: '123' });
      const orgData = { orgID: '1', name: 'Test Org' };
      const adminsData = { results: [{ userID: '234' }] };
      const memberCountData = { count: 5 };
      const eventsData = { results: [{ eventID: '10', title: 'Event 1' }] };
      const rsvpCountData = { count: 15 };
      
      mockBackendService.queryFirst
        .mockResolvedValueOnce({ userID: '123' }) // In staff table
        .mockResolvedValueOnce(orgData)          // Organization data
        .mockResolvedValueOnce(memberCountData)  // Member count
        .mockResolvedValueOnce(rsvpCountData);   // RSVP count
        
      mockBackendService.query
        .mockResolvedValueOnce(adminsData)       // Admins data
        .mockResolvedValueOnce(eventsData);      // Events data
      
      const request = createMockRequest();
      
      // Act
      const response = await adminController.getOrganizationDetails(request, '1');
      const jsonResponse = await response.json();
      
      // Assert
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.organization).toEqual(orgData);
      expect(jsonResponse.admins).toEqual(adminsData.results);
      expect(jsonResponse.memberCount).toBe(memberCountData.count);
      expect(jsonResponse.events).toEqual(eventsData.results);
      expect(jsonResponse.totalRSVPs).toBe(rsvpCountData.count);
    });
  });

  describe('approveOfficial', () => {
    it('should return 401 if not authenticated', async () => {
      // Arrange
      mockAuth.getAuthFromRequest.mockReturnValue({ isAuthenticated: false });
      const request = createMockRequest();
      
      // Act
      const response = await adminController.approveOfficial(request);
      const jsonResponse = await response.json();
      
      // Assert
      expect(response.options.status).toBe(401);
      expect(jsonResponse.success).toBe(false);
    });

    it('should return 403 if not staff', async () => {
      // Arrange
      mockAuth.getAuthFromRequest.mockReturnValue({ isAuthenticated: true, userId: '123' });
      mockBackendService.queryFirst.mockResolvedValue(null); // Not in staff table
      const request = createMockRequest({ orgID: '1' });
      
      // Act
      const response = await adminController.approveOfficial(request);
      const jsonResponse = await response.json();
      
      // Assert
      expect(response.options.status).toBe(403);
      expect(jsonResponse.success).toBe(false);
    });

    it('should return 400 if no ID provided', async () => {
      // Arrange
      mockAuth.getAuthFromRequest.mockReturnValue({ isAuthenticated: true, userId: '123' });
      mockBackendService.queryFirst.mockResolvedValue({ userID: '123' }); // In staff table
      const request = createMockRequest({}); // No orgID or eventID
      
      // Act
      const response = await adminController.approveOfficial(request);
      const jsonResponse = await response.json();
      
      // Assert
      expect(response.options.status).toBe(400);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBe('Either orgID or eventID must be provided');
    });

    it('should return 404 if no pending request exists', async () => {
      // Arrange
      mockAuth.getAuthFromRequest.mockReturnValue({ isAuthenticated: true, userId: '123' });
      mockBackendService.queryFirst
        .mockResolvedValueOnce({ userID: '123' }) // In staff table
        .mockResolvedValueOnce(null);             // No pending request
      const request = createMockRequest({ orgID: '1' });
      
      // Act
      const response = await adminController.approveOfficial(request);
      const jsonResponse = await response.json();
      
      // Assert
      expect(response.options.status).toBe(404);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBe('No pending official status request found');
    });

    it('should approve organization official status', async () => {
      // Arrange
      mockAuth.getAuthFromRequest.mockReturnValue({ isAuthenticated: true, userId: '123' });
      mockBackendService.queryFirst
        .mockResolvedValueOnce({ userID: '123' })           // In staff table
        .mockResolvedValueOnce({ orgID: '1' });             // Pending request
      
      const request = createMockRequest({ orgID: '1' });
      
      // Act
      const response = await adminController.approveOfficial(request);
      const jsonResponse = await response.json();
      
      // Assert
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.message).toBe('Official status approved');
      expect(mockBackendService.query).toHaveBeenCalledWith(
        "INSERT INTO OFFICIAL (orgID, eventID) VALUES (?, ?)",
        ['1', null]
      );
      expect(mockBackendService.query).toHaveBeenCalledWith(
        "DELETE FROM OFFICIAL_PENDING WHERE orgID = ?",
        ['1']
      );
    });
  });

  // Add more test suites for other methods
  describe('submitForOfficial', () => {
    it('should return 401 if not authenticated', async () => {
      // Arrange
      mockAuth.getAuthFromRequest.mockReturnValue({ isAuthenticated: false });
      const request = createMockRequest();
      
      // Act
      const response = await adminController.submitForOfficial(request);
      const jsonResponse = await response.json();
      
      // Assert
      expect(response.options.status).toBe(401);
      expect(jsonResponse.success).toBe(false);
    });
    
    it('should return 400 if no ID provided', async () => {
      // Arrange
      mockAuth.getAuthFromRequest.mockReturnValue({ isAuthenticated: true, userId: '123' });
      const request = createMockRequest({});
      
      // Act
      const response = await adminController.submitForOfficial(request);
      const jsonResponse = await response.json();
      
      // Assert
      expect(response.options.status).toBe(400);
      expect(jsonResponse.success).toBe(false);
    });
    
    it('should return 403 if user is not admin', async () => {
      // Arrange
      mockAuth.getAuthFromRequest.mockReturnValue({ isAuthenticated: true, userId: '123' });
      mockBackendService.queryFirst.mockResolvedValue(null); // Not an admin
      const request = createMockRequest({ orgID: '1' });
      
      // Act
      const response = await adminController.submitForOfficial(request);
      const jsonResponse = await response.json();
      
      // Assert
      expect(response.options.status).toBe(403);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBe('Only admins can submit for official status');
    });
    
    it('should successfully submit for official status', async () => {
      // Arrange
      mockAuth.getAuthFromRequest.mockReturnValue({ isAuthenticated: true, userId: '123' });
      mockBackendService.queryFirst
        .mockResolvedValueOnce({ userID: '123' })                    // Is admin
        .mockResolvedValueOnce({ thumbnail: 'thumb.jpg', banner: 'banner.jpg' }) // Has required images
        .mockResolvedValueOnce(null)                                 // Not already pending
        .mockResolvedValueOnce(null);                                // Not already official
      const request = createMockRequest({ orgID: '1' });
      
      // Act
      const response = await adminController.submitForOfficial(request);
      const jsonResponse = await response.json();
      
      // Assert
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.message).toBe('Successfully submitted for official status');
      expect(mockBackendService.query).toHaveBeenCalledWith(
        "INSERT INTO OFFICIAL_PENDING (orgID, eventID) VALUES (?, ?)",
        ['1', null]
      );
    });
  });
});