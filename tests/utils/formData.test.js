import { jest } from '@jest/globals';
import { parseFormData } from '../../client/src/utils/formData.js';

// Mock FormData since it's not available in Node.js environment
global.FormData = class FormData {
  constructor() {
    this.data = {};
  }

  append(key, value) {
    this.data[key] = value;
  }

  get(key) {
    return this.data[key];
  }

  entries() {
    return Object.entries(this.data);
  }

  // Add this to support Object.entries in the test
  [Symbol.iterator]() {
    return this.entries()[Symbol.iterator]();
  }
};

describe('FormData Utilities', () => {
  describe('parseFormData', () => {
    test('should handle multipart/form-data content type', async () => {
      // Mock formData result
      const mockFormData = new FormData();
      mockFormData.append('name', 'Test Org');
      mockFormData.append('description', 'Test Description');
      
      // Mock request
      const request = {
        headers: {
          get: jest.fn().mockReturnValue('multipart/form-data; boundary=something')
        },
        formData: jest.fn().mockResolvedValue(mockFormData)
      };

      const result = await parseFormData(request);
      
      // Verify headers were checked with correct parameter
      expect(request.headers.get).toHaveBeenCalledWith('content-type');
      
      // Verify formData was called
      expect(request.formData).toHaveBeenCalled();
      
      // Verify the result is the mock FormData
      expect(result).toBe(mockFormData);
    });

    test('should handle application/x-www-form-urlencoded content type', async () => {
      // Mock formData result
      const mockFormData = new FormData();
      mockFormData.append('name', 'Test Org');
      mockFormData.append('description', 'Test Description');
      
      // Mock request
      const request = {
        headers: {
          get: jest.fn().mockReturnValue('application/x-www-form-urlencoded')
        },
        formData: jest.fn().mockResolvedValue(mockFormData)
      };

      const result = await parseFormData(request);
      
      // Verify correct content type was checked
      expect(request.headers.get).toHaveBeenCalledWith('content-type');
      
      // Verify formData was called
      expect(request.formData).toHaveBeenCalled();
      
      // Verify the result is the mock FormData
      expect(result).toBe(mockFormData);
    });

    test('should handle application/json content type', async () => {
      // Mock JSON data
      const jsonData = {
        name: 'Test Org',
        description: 'Test Description'
      };
      
      // Mock request
      const request = {
        headers: {
          get: jest.fn().mockReturnValue('application/json')
        },
        json: jest.fn().mockResolvedValue(jsonData)
      };

      const result = await parseFormData(request);
      
      // Verify content type check
      expect(request.headers.get).toHaveBeenCalledWith('content-type');
      
      // Verify json method was called
      expect(request.json).toHaveBeenCalled();
      
      // Verify FormData contains the JSON data
      expect(result).toBeInstanceOf(FormData);
      expect(result.get('name')).toBe('Test Org');
      expect(result.get('description')).toBe('Test Description');
    });

    test('should handle nested JSON objects', async () => {
      // Mock JSON data with nested object
      const jsonData = {
        name: 'Test Org',
        location: {
          address: '123 Main St',
          city: 'Testville'
        }
      };
      
      // Mock request
      const request = {
        headers: {
          get: jest.fn().mockReturnValue('application/json')
        },
        json: jest.fn().mockResolvedValue(jsonData)
      };

      const result = await parseFormData(request);
      
      // Verify FormData contains the flattened JSON data
      expect(result.get('name')).toBe('Test Org');
      expect(result.get('location')).toBe(jsonData.location);
    });

    test('should return empty FormData for unsupported content type', async () => {
      // Mock request with unsupported content type
      const request = {
        headers: {
          get: jest.fn().mockReturnValue('text/plain')
        }
      };

      const result = await parseFormData(request);
      
      // Verify content type check
      expect(request.headers.get).toHaveBeenCalledWith('content-type');
      
      // Verify result is empty FormData
      expect(result).toBeInstanceOf(FormData);
      expect(Array.from(result.entries()).length).toBe(0);
    });

    test('should handle missing content-type header', async () => {
      // Mock request with no content-type
      const request = {
        headers: {
          get: jest.fn().mockReturnValue('')
        }
      };

      const result = await parseFormData(request);
      
      // Verify content type check
      expect(request.headers.get).toHaveBeenCalledWith('content-type');
      
      // Verify result is empty FormData
      expect(result).toBeInstanceOf(FormData);
      expect(Array.from(result.entries()).length).toBe(0);
    });
  });
});