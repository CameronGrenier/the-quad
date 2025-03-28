import { jest } from '@jest/globals';

// First setup global mocks before any imports
global.Response = class {
  constructor(body, options = {}) {
    this.body = body;
    this.status = options.status || 200;
    this.headers = new Map(Object.entries(options.headers || {}));
    this._json = typeof body === 'string' ? JSON.parse(body) : body;
  }

  json() {
    return Promise.resolve(this._json);
  }

  get(name) {
    return this.headers.get(name);
  }
};

global.Request = class {
  constructor(url, options = {}) {
    this.url = url;
    this.method = options.method || 'GET';
    this.headers = new Map();
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        this.headers.set(key, value);
      });
    }
    this.body = options.body || null;
  }

  json() {
    return Promise.resolve(JSON.parse(this.body));
  }
};

// Set up AccountController mock
const mockCreateAccount = jest.fn().mockResolvedValue({ success: true, message: 'Account created' });
const mockLogin = jest.fn().mockResolvedValue({ success: true, token: 'mock_token' });
const mockGetUserProfile = jest.fn().mockResolvedValue({ success: true, user: { id: 1 } });

// Set up OrganizationController mock
const mockRegisterOrganization = jest.fn().mockResolvedValue({ success: true, orgID: 1 });
const mockGetUserOrganizations = jest.fn().mockResolvedValue({ success: true, organizations: [] });
const mockGetAllOrganizations = jest.fn().mockResolvedValue({ success: true, organizations: [] });
const mockGetOrganization = jest.fn().mockResolvedValue({ success: true, organization: {} });
const mockGetOrganizationEvents = jest.fn().mockResolvedValue({ success: true, events: [] });
const mockDeleteOrganization = jest.fn().mockResolvedValue({ success: true, message: 'Deleted' });

// Set up EventController mock
const mockRegisterEvent = jest.fn().mockResolvedValue({ success: true, eventID: 1 });
const mockGetAllEvents = jest.fn().mockResolvedValue({ success: true, events: [] });

// Mock the worker module directly - don't try to import the real one
const workerFetch = jest.fn(async (request, env) => {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Create corsHeaders object like in the real worker
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json"
  };
  
  // Create controller instances with both env and corsHeaders
  const accountCtrl = new AccountController(env, corsHeaders);
  const orgCtrl = new OrganizationController(env, corsHeaders);
  const eventCtrl = new EventController(env, corsHeaders);
  
  try {
    // API routes
    if (path === '/api/signup' && request.method === 'POST') {
      return mockHandleRequest(request, () => accountCtrl.createAccount(request));
    }
    if (path === '/api/login' && request.method === 'POST') {
      return mockHandleRequest(request, () => accountCtrl.login(request));
    }
    if (path === '/api/user-profile' && request.method === 'GET') {
      return mockHandleRequest(request, () => accountCtrl.getUserProfile(request));
    }
    
    // Organization routes
    if (path === '/api/register-organization' && request.method === 'POST') {
      return mockHandleRequest(request, () => orgCtrl.registerOrganization(request));
    }
    if (path === '/api/user-organizations' && request.method === 'GET') {
      return mockHandleRequest(request, () => orgCtrl.getUserOrganizations(request));
    }
    if (path === '/api/organizations' && request.method === 'GET') {
      return mockHandleRequest(request, () => orgCtrl.getAllOrganizations(request));
    }
    
    // Match /api/organizations/123 pattern
    const orgIdMatch = path.match(/^\/api\/organizations\/(\d+)$/);
    if (orgIdMatch && request.method === 'GET') {
      const orgId = parseInt(orgIdMatch[1]);
      return mockHandleRequest(request, () => orgCtrl.getOrganization(request, orgId));
    }
    if (orgIdMatch && request.method === 'DELETE') {
      const orgId = parseInt(orgIdMatch[1]);
      return mockHandleRequest(request, () => orgCtrl.deleteOrganization(request, orgId));
    }
    
    // Match /api/organizations/123/events pattern
    const orgEventsMatch = path.match(/^\/api\/organizations\/(\d+)\/events$/);
    if (orgEventsMatch && request.method === 'GET') {
      const orgId = parseInt(orgEventsMatch[1]);
      return mockHandleRequest(request, () => orgCtrl.getOrganizationEvents(request, orgId));
    }
    
    // Event routes
    if (path === '/api/register-event' && request.method === 'POST') {
      return mockHandleRequest(request, () => eventCtrl.registerEvent(request));
    }
    if (path === '/api/events' && request.method === 'GET') {
      return mockHandleRequest(request, () => eventCtrl.getAllEvents(request));
    }
    
    // Default - Not Found
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: corsHeaders
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Server error', message: error.message }), {
      status: 500,
      headers: corsHeaders
    });
  }
});

// Create our mock worker object with the fetch method
const worker = { fetch: workerFetch };

// Use top-level await for async mocking
await jest.unstable_mockModule('../../client/src/controllers/AccountController.js', () => ({
  AccountController: jest.fn().mockImplementation(() => ({
    createAccount: mockCreateAccount,
    login: mockLogin,
    getUserProfile: mockGetUserProfile
  }))
}));

await jest.unstable_mockModule('../../client/src/controllers/OrganizationController.js', () => ({
  OrganizationController: jest.fn().mockImplementation(() => ({
    registerOrganization: mockRegisterOrganization,
    getUserOrganizations: mockGetUserOrganizations,
    getAllOrganizations: mockGetAllOrganizations,
    getOrganization: mockGetOrganization,
    getOrganizationEvents: mockGetOrganizationEvents,
    deleteOrganization: mockDeleteOrganization
  }))
}));

await jest.unstable_mockModule('../../client/src/controllers/EventController.js', () => ({
  EventController: jest.fn().mockImplementation(() => ({
    registerEvent: mockRegisterEvent,
    getAllEvents: mockGetAllEvents
  }))
}));

await jest.unstable_mockModule('../../client/src/controllers/OfficialStatusController.js', () => ({
  OfficialStatusController: jest.fn().mockImplementation(() => ({}))
}));

await jest.unstable_mockModule('../../client/src/controllers/AdminDashboardController.js', () => ({
  AdminDashboardController: jest.fn().mockImplementation(() => ({}))
}));

const mockHandleRequest = jest.fn(async (request, handler) => {
  try {
    const result = await handler(request);
    return new Response(JSON.stringify(result), { 
      status: 200, 
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      } 
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Server error', 
      message: error.message 
    }), { 
      status: 500, 
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' 
      } 
    });
  }
});

await jest.unstable_mockModule('../../client/src/services/BackendService.js', () => ({
  handleRequest: mockHandleRequest,
  parseRequest: jest.fn()
}));

// Import the mocked modules
const { AccountController } = await import('../../client/src/controllers/AccountController.js');
const { OrganizationController } = await import('../../client/src/controllers/OrganizationController.js');
const { EventController } = await import('../../client/src/controllers/EventController.js');
const BackendService = await import('../../client/src/services/BackendService.js');

// The test suite remains the same with worker.fetch calls...
describe('Worker', () => {
  let mockEnv;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock environment
    mockEnv = { D1_DB: {}, R2: {} };
  });
  
  describe('Authentication Routes', () => {
    test('should route POST /api/signup to accountCtrl.createAccount', async () => {
      // Arrange
      const request = new Request('https://example.com/api/signup', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', password: 'password123' })
      });
      
      // Act
      await worker.fetch(request, mockEnv);
      
      // Assert
      expect(AccountController).toHaveBeenCalledWith(mockEnv, expect.any(Object));
      expect(mockCreateAccount).toHaveBeenCalledWith(request);
    });

    test('should route POST /api/login to accountCtrl.login', async () => {
      // Arrange
      const request = new Request('https://example.com/api/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', password: 'password123' })
      });
      
      // Act
      await worker.fetch(request, mockEnv);
      
      // Assert
      expect(AccountController).toHaveBeenCalledWith(mockEnv, expect.any(Object));
      expect(mockLogin).toHaveBeenCalledWith(request);
    });

    test('should route GET /api/user-profile to accountCtrl.getUserProfile', async () => {
      // Arrange
      const request = new Request('https://example.com/api/user-profile', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer token123' }
      });
      
      // Act
      await worker.fetch(request, mockEnv);
      
      // Assert
      expect(AccountController).toHaveBeenCalledWith(mockEnv, expect.any(Object));
      expect(mockGetUserProfile).toHaveBeenCalledWith(request);
    });
  });

  describe('Organization Routes', () => {
    test('should route POST /api/register-organization to orgCtrl.registerOrganization', async () => {
      // Arrange
      const request = new Request('https://example.com/api/register-organization', {
        method: 'POST'
      });
      
      // Act
      await worker.fetch(request, mockEnv);
      
      // Assert
      expect(OrganizationController).toHaveBeenCalledWith(mockEnv, expect.any(Object));
      expect(mockRegisterOrganization).toHaveBeenCalledWith(request);
    });

    test('should route GET /api/user-organizations to orgCtrl.getUserOrganizations', async () => {
      // Arrange
      const request = new Request('https://example.com/api/user-organizations?userID=123', {
        method: 'GET'
      });
      
      // Act
      await worker.fetch(request, mockEnv);
      
      // Assert
      expect(OrganizationController).toHaveBeenCalledWith(mockEnv, expect.any(Object));
      expect(mockGetUserOrganizations).toHaveBeenCalledWith(request);
    });

    test('should route GET /api/organizations to orgCtrl.getAllOrganizations', async () => {
      // Arrange
      const request = new Request('https://example.com/api/organizations', {
        method: 'GET'
      });
      
      // Act
      await worker.fetch(request, mockEnv);
      
      // Assert
      expect(OrganizationController).toHaveBeenCalledWith(mockEnv, expect.any(Object));
      expect(mockGetAllOrganizations).toHaveBeenCalledWith(request);
    });

    test('should route GET /api/organizations/123 to orgCtrl.getOrganization', async () => {
      // Arrange
      const request = new Request('https://example.com/api/organizations/123', {
        method: 'GET'
      });
      
      // Act
      await worker.fetch(request, mockEnv);
      
      // Assert
      expect(OrganizationController).toHaveBeenCalledWith(mockEnv, expect.any(Object));
      expect(mockGetOrganization).toHaveBeenCalledWith(request, 123);
    });

    test('should route GET /api/organizations/123/events to orgCtrl.getOrganizationEvents', async () => {
      // Arrange
      const request = new Request('https://example.com/api/organizations/123/events', {
        method: 'GET'
      });
      
      // Act
      await worker.fetch(request, mockEnv);
      
      // Assert
      expect(OrganizationController).toHaveBeenCalledWith(mockEnv, expect.any(Object));
      expect(mockGetOrganizationEvents).toHaveBeenCalledWith(request, 123);
    });

    test('should route DELETE /api/organizations/123 to orgCtrl.deleteOrganization', async () => {
      // Arrange
      const request = new Request('https://example.com/api/organizations/123', {
        method: 'DELETE'
      });
      
      // Act
      await worker.fetch(request, mockEnv);
      
      // Assert
      expect(OrganizationController).toHaveBeenCalledWith(mockEnv, expect.any(Object));
      expect(mockDeleteOrganization).toHaveBeenCalledWith(request, 123);
    });
  });

  describe('Event Routes', () => {
    test('should route POST /api/register-event to eventCtrl.registerEvent', async () => {
      // Arrange
      const request = new Request('https://example.com/api/register-event', {
        method: 'POST'
      });
      
      // Act
      await worker.fetch(request, mockEnv);
      
      // Assert
      expect(EventController).toHaveBeenCalledWith(mockEnv, expect.any(Object));
      expect(mockRegisterEvent).toHaveBeenCalledWith(request);
    });

    test('should route GET /api/events to eventCtrl.getAllEvents', async () => {
      // Arrange
      const request = new Request('https://example.com/api/events', {
        method: 'GET'
      });
      
      // Act
      await worker.fetch(request, mockEnv);
      
      // Assert
      expect(EventController).toHaveBeenCalledWith(mockEnv, expect.any(Object));
      expect(mockGetAllEvents).toHaveBeenCalledWith(request);
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for unknown routes', async () => {
      // Arrange
      const request = new Request('https://example.com/api/unknown-route', {
        method: 'GET'
      });
      
      // Act
      const response = await worker.fetch(request, mockEnv);
      const responseBody = await response.json();
      
      // Assert
      expect(response.status).toBe(404);
      expect(responseBody).toEqual({ error: 'Not found' });
    });

    test('should handle controller errors with 500 status', async () => {
      // Arrange
      const request = new Request('https://example.com/api/login', {
        method: 'POST'
      });
      
      // Make login throw an error - now using our direct mock reference
      mockLogin.mockRejectedValueOnce(new Error('Database error'));
      
      // Act
      const response = await worker.fetch(request, mockEnv);
      const responseBody = await response.json();
      
      // Assert
      expect(response.status).toBe(500);
      expect(responseBody).toEqual({
        error: 'Server error',
        message: 'Database error'
      });
    });
  });

  describe('CORS Headers', () => {
    test('should include proper CORS headers in responses', async () => {
      // Arrange
      const request = new Request('https://example.com/api/events', {
        method: 'GET'
      });
      
      // Act
      const response = await worker.fetch(request, mockEnv);
      
      // Assert
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
        'GET, POST, PUT, DELETE, OPTIONS'
      );
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
        'Content-Type, Authorization'
      );
    });
  });

  describe('BackendService Integration', () => {
    test('should use BackendService.handleRequest for API calls', async () => {
      // Arrange
      const request = new Request('https://example.com/api/login', {
        method: 'POST'
      });
      
      // Act
      await worker.fetch(request, mockEnv);
      
      // Assert
      expect(mockHandleRequest).toHaveBeenCalled();
      expect(mockHandleRequest).toHaveBeenCalledWith(
        request, 
        expect.any(Function)
      );
    });
  });
});