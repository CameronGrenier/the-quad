import { jest } from '@jest/globals';
import { BackendService } from '../../client/src/services/BackendService.js';

// Mock browser APIs that aren't available in Node.js
global.FormData = class FormData {
  constructor() {
    this.data = new Map();
  }

  append(key, value) {
    this.data.set(key, value);
  }

  get(key) {
    return this.data.get(key);
  }

  forEach(callback) {
    this.data.forEach((value, key) => callback(value, key));
  }

  entries() {
    return Array.from(this.data.entries());
  }

  [Symbol.iterator]() {
    return this.entries()[Symbol.iterator]();
  }
};

global.Headers = class Headers {
  constructor(headers = {}) {
    this.headers = new Map();
    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        this.set(key, value);
      });
    }
  }

  get(name) {
    return this.headers.get(name.toLowerCase());
  }

  set(name, value) {
    this.headers.set(name.toLowerCase(), value);
  }
};

global.Request = class Request {
  constructor(url, options = {}) {
    this.url = url;
    this.method = options.method || 'GET';
    this.headers = new Headers(options.headers);
    this.body = options.body;
  }

  // These will be mocked in tests as needed
  json() { return Promise.resolve({}); }
  text() { return Promise.resolve(""); }
  formData() { return Promise.resolve(new FormData()); }
};

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
  
  text() {
    return Promise.resolve(this.body);
  }
  
  get(name) {
    return this.headers.get(name);
  }
};

describe('BackendService', () => {
  test('BackendService class should exist', () => {
    expect(BackendService).toBeDefined();
  });
  
  describe('handleRequest', () => {
    test('should handle successful requests', async () => {
      const mockRequest = new Request('https://example.com');
      const mockHandler = jest.fn().mockResolvedValue({ message: 'success' });
      
      const response = await BackendService.handleRequest(mockRequest, mockHandler);
      
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toEqual({ success: true, message: 'success' });
    });

    test('should handle successful requests with data', async () => {
      const mockRequest = new Request('https://example.com');
      const mockHandler = jest.fn().mockResolvedValue({ data: 'test data' });

      const response = await BackendService.handleRequest(mockRequest, mockHandler);
      
      expect(response).toBeInstanceOf(Response);
      
      const responseData = await response.json();
      expect(responseData).toEqual({ success: true, data: 'test data' });
      
      expect(mockHandler).toHaveBeenCalledWith(mockRequest);
    });

    test('should handle errors', async () => {
      const mockRequest = new Request('https://example.com');
      const mockHandler = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const response = await BackendService.handleRequest(mockRequest, mockHandler);
      
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(500);
      
      const responseData = await response.json();
      expect(responseData).toEqual({ success: false, error: 'Test error' });
    });
    
    test('should handle OPTIONS requests for CORS', async () => {
      const mockRequest = new Request('https://example.com', {
        method: 'OPTIONS'
      });
      
      const mockHandler = jest.fn();

      const response = await BackendService.handleRequest(mockRequest, mockHandler);
      
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
      expect(mockHandler).not.toHaveBeenCalled();
      
      // Check CORS headers
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });
    
    test('should include all expected headers in response', async () => {
      const mockRequest = new Request('https://example.com');
      const mockHandler = jest.fn().mockResolvedValue({});
      
      const response = await BackendService.handleRequest(mockRequest, mockHandler);
      
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeDefined();
      expect(response.headers.get('Access-Control-Allow-Headers')).toBeDefined();
    });
  });

  describe('parseRequest', () => {
    test('should parse JSON request', async () => {
      const jsonBody = { name: 'Test', value: 123 };
      const mockRequest = new Request('https://example.com', {
        headers: { 'Content-Type': 'application/json' },
        method: 'POST'
      });
      
      mockRequest.json = jest.fn().mockResolvedValue(jsonBody);

      const result = await BackendService.parseRequest(mockRequest);
      
      expect(result).toEqual(jsonBody);
      expect(mockRequest.json).toHaveBeenCalled();
    });

    test('should parse form data request', async () => {
      const formData = new FormData();
      formData.append('name', 'Test');
      formData.append('value', '123');
      
      const mockRequest = new Request('https://example.com', {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        method: 'POST'
      });
      
      mockRequest.formData = jest.fn().mockResolvedValue(formData);

      const result = await BackendService.parseRequest(mockRequest);
      
      expect(result).toEqual({ name: 'Test', value: '123' });
      expect(mockRequest.formData).toHaveBeenCalled();
    });

    test('should handle empty form data', async () => {
      const emptyFormData = new FormData();
      
      const mockRequest = new Request('https://example.com', {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        method: 'POST'
      });
      
      mockRequest.formData = jest.fn().mockResolvedValue(emptyFormData);

      const result = await BackendService.parseRequest(mockRequest);
      
      expect(result).toEqual({});
    });

    test('should throw for unsupported content type', async () => {
      const mockRequest = new Request('https://example.com', {
        headers: { 'Content-Type': 'text/plain' },
        method: 'POST'
      });

      await expect(BackendService.parseRequest(mockRequest)).rejects.toThrow('Unsupported content type');
    });
  });
});