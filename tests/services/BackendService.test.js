import { BackendService } from '../../client/src/services/BackendService.js';

// Mock Response since it doesn't exist in Node.js environment
global.Response = class Response {
  constructor(body, options = {}) {
    this.body = body;
    this.status = options.status || 200;
    this.headers = new Map();
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        this.headers.set(key, value);
      });
    }
  }
  
  json() {
    return Promise.resolve(JSON.parse(this.body));
  }
  
  get(name) {
    return this.headers.get(name);
  }
};

// Import jest functions - in Jest, the functions are available globally,
// but we need to reference them differently
const createMockFunction = () => {
  const fn = (...args) => {
    fn.calls.push(args);
    return fn.returnValue;
  };
  fn.calls = [];
  fn.mockReturnValue = (val) => {
    fn.returnValue = val;
    return fn;
  };
  fn.mockResolvedValue = (val) => {
    fn.returnValue = Promise.resolve(val);
    return fn;
  };
  fn.mockImplementation = (implementation) => {
    fn.implementation = implementation;
    fn.mockReturnValue = () => fn;
    fn.returnValue = (...args) => implementation(...args);
    return fn;
  };
  fn.mockClear = () => {
    fn.calls = [];
    return fn;
  };
  return fn;
};

// Simple test first to verify basic functionality
describe('BackendService', () => {
  test('BackendService class should exist', () => {
    expect(BackendService).toBeDefined();
  });
  
  // More complex tests can follow once we confirm the basic setup works
  describe('handleRequest', () => {
    test('should handle successful requests', async () => {
      const mockRequest = new Request('https://example.com');
      const mockHandler = createMockFunction().mockResolvedValue({ message: 'success' });
      
      const response = await BackendService.handleRequest(mockRequest, mockHandler);
      expect(response).toBeInstanceOf(Response);
    });

    test('should handle successful requests with data', async () => {
      // Mock request
      const mockRequest = new Request('https://example.com');
      
      // Mock handler that returns data
      const mockHandler = createMockFunction().mockResolvedValue({ 
        data: 'test data' 
      });

      // Call handleRequest
      const response = await BackendService.handleRequest(mockRequest, mockHandler);
      expect(response).toBeInstanceOf(Response);
      
      // Parse response data
      const responseData = await response.json();
      expect(responseData).toEqual({ 
        success: true, 
        data: 'test data' 
      });
      
      // Verify handler was called
      expect(mockHandler.calls.length).toBe(1);
      expect(mockHandler.calls[0][0]).toBe(mockRequest);
    });

    test('should handle errors', async () => {
      // Mock request
      const mockRequest = new Request('https://example.com');
      
      // Create a handler that definitely throws an error when called
      const mockHandler = () => {
        throw new Error('Test error');
      };
      
      // Call handleRequest
      const response = await BackendService.handleRequest(mockRequest, mockHandler);
      expect(response).toBeInstanceOf(Response);
      
      // Parse response
      const responseData = await response.json();
      expect(responseData).toEqual({ 
        success: false, 
        error: 'Test error' 
      });
      expect(response.status).toBe(500);
    });
    
    test('should handle OPTIONS requests for CORS', async () => {
      // Create mock OPTIONS request
      const mockRequest = new Request('https://example.com', {
        method: 'OPTIONS'
      });
      
      // Create mock handler with tracking flag
      const wasHandlerCalled = { value: false };
      const mockHandler = () => { 
        wasHandlerCalled.value = true;
        return {}; 
      };

      // Call handleRequest
      const response = await BackendService.handleRequest(mockRequest, mockHandler);
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
      
      // Verify handler was not called
      expect(wasHandlerCalled.value).toBe(false);
    });
  });

  describe('parseRequest', () => {
    test('should parse JSON request', async () => {
      const jsonBody = { name: 'Test', value: 123 };
      const mockRequest = new Request('https://example.com', {
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        body: JSON.stringify(jsonBody)
      });
      
      // Mock request.json()
      mockRequest.json = createMockFunction().mockResolvedValue(jsonBody);

      const result = await BackendService.parseRequest(mockRequest);
      expect(result).toEqual(jsonBody);
      expect(mockRequest.json.calls.length).toBe(1);
    });

    test('should parse form data request', async () => {
      const formData = new FormData();
      formData.append('name', 'Test');
      formData.append('value', '123');
      
      const mockRequest = new Request('https://example.com', {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        method: 'POST',
        body: formData
      });
      
      // Mock request.formData()
      mockRequest.formData = createMockFunction().mockResolvedValue(formData);

      const result = await BackendService.parseRequest(mockRequest);
      expect(result).toEqual({ name: 'Test', value: '123' });
      expect(mockRequest.formData.calls.length).toBe(1);
    });

    test('should throw for unsupported content type', async () => {
      const mockRequest = new Request('https://example.com', {
        headers: { 'Content-Type': 'text/plain' },
        method: 'POST',
        body: 'plain text'
      });

      await expect(BackendService.parseRequest(mockRequest)).rejects.toThrow('Unsupported content type');
    });
  });
});