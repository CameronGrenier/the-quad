import { jest } from '@jest/globals';
import { uploadFileToR2, serveImageFromR2 } from '../../client/src/utils/storage.js';

// Mock Response object properly
global.Response = class Response {
  constructor(body, options = {}) {
    this.body = body;
    this.status = options.status || 200;
    this._headers = new Map();
    
    // Add headers from options
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        this._headers.set(key.toLowerCase(), value);
      });
    }
  }
  
  // Headers accessor
  get headers() {
    return {
      get: (name) => this._headers.get(name.toLowerCase()),
    };
  }
};

describe('Storage Utilities', () => {
  // Test suite for uploadFileToR2 function
  describe('uploadFileToR2', () => {
    // Test uploading a file successfully
    test('should upload file to R2 bucket and return URL path', async () => {
      // Mock environment and file
      const mockPut = jest.fn().mockResolvedValue(true);
      const env = { R2_BUCKET: { put: mockPut } };
      
      // Mock file with arrayBuffer method
      const mockBuffer = new ArrayBuffer(8);
      const mockFile = {
        arrayBuffer: jest.fn().mockResolvedValue(mockBuffer),
        type: 'image/jpeg'
      };
      
      const path = 'test-file.jpg';
      const result = await uploadFileToR2(env, mockFile, path);
      
      // Verify R2 put was called with correct arguments
      expect(mockFile.arrayBuffer).toHaveBeenCalled();
      expect(mockPut).toHaveBeenCalledWith(
        path, 
        mockBuffer, 
        { httpMetadata: { contentType: 'image/jpeg' } }
      );
      
      // Verify returned path
      expect(result).toBe(`/images/${path}`);
    });
    
    // Test error when R2_BUCKET is missing
    test('should throw error if R2_BUCKET binding is missing', async () => {
      const env = {};
      const mockFile = {};
      
      await expect(uploadFileToR2(env, mockFile, 'test.jpg'))
        .rejects
        .toThrow('Missing R2_BUCKET binding');
    });
    
    // Test with file missing content type
    test('should use default content type when file type is missing', async () => {
      const mockPut = jest.fn().mockResolvedValue(true);
      const env = { R2_BUCKET: { put: mockPut } };
      
      const mockBuffer = new ArrayBuffer(8);
      const mockFile = {
        arrayBuffer: jest.fn().mockResolvedValue(mockBuffer),
        type: '' // No content type
      };
      
      const path = 'test-file.dat';
      await uploadFileToR2(env, mockFile, path);
      
      // Verify default content type was used
      expect(mockPut).toHaveBeenCalledWith(
        path, 
        mockBuffer, 
        { httpMetadata: { contentType: 'application/octet-stream' } }
      );
    });
  });
  
  // Test suite for serveImageFromR2 function
  describe('serveImageFromR2', () => {
    // Test successfully serving an image
    test('should return image response with correct headers', async () => {
      const mockObject = {
        body: 'test-image-data'
      };
      
      const mockGet = jest.fn().mockResolvedValue(mockObject);
      const env = { R2_BUCKET: { get: mockGet } };
      const corsHeaders = { "Access-Control-Allow-Origin": "*" };
      
      const response = await serveImageFromR2(env, 'test.jpg', corsHeaders);
      
      // Verify R2 get was called
      expect(mockGet).toHaveBeenCalledWith('test.jpg');
      
      // Verify response properties
      expect(response.status).toBe(200);
      // Don't check exact body content, just verify it exists
      expect(response.body).toBeDefined();
      expect(response.headers.get('Content-Type')).toBe('image/jpeg');
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
    
    // Test fallback to root level image
    test('should attempt to find image at root level if not found in path', async () => {
      const mockObject = {
        body: 'test-image-data'
      };
      
      const mockGet = jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockObject);
        
      const env = { R2_BUCKET: { get: mockGet } };
      const corsHeaders = { "Access-Control-Allow-Origin": "*" };
      
      const response = await serveImageFromR2(env, 'images/test.png', corsHeaders);
      
      // Verify both gets were called correctly
      expect(mockGet).toHaveBeenCalledTimes(2);
      expect(mockGet.mock.calls[0][0]).toBe('images/test.png');
      expect(mockGet.mock.calls[1][0]).toBe('test.png');
      
      // Verify response properties
      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
      expect(response.headers.get('Content-Type')).toBe('image/png');
    });
    
    // Test image not found
    test('should return 404 if image is not found', async () => {
      const mockGet = jest.fn().mockResolvedValue(null);
      const env = { R2_BUCKET: { get: mockGet } };
      const corsHeaders = { "Access-Control-Allow-Origin": "*" };
      
      const response = await serveImageFromR2(env, 'images/test.png', corsHeaders);
      
      // Verify response is 404
      expect(response.status).toBe(404);
      expect(response.body).toBeDefined();
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
    
    // Test content type determination for different file types
    test('should determine correct content type based on file extension', async () => {
      const mockObject = { body: 'test-image-data' };
      const mockGet = jest.fn().mockResolvedValue(mockObject);
      const env = { R2_BUCKET: { get: mockGet } };
      const corsHeaders = { "Access-Control-Allow-Origin": "*" };
      
      // Test different file extensions
      const fileTypes = [
        { path: 'test.jpg', expected: 'image/jpeg' },
        { path: 'test.png', expected: 'image/png' },
        { path: 'test.gif', expected: 'image/gif' },
        { path: 'test.svg', expected: 'image/svg+xml' },
        { path: 'test.webp', expected: 'image/webp' },
        { path: 'test.unknown', expected: 'application/octet-stream' }
      ];
      
      for (const { path, expected } of fileTypes) {
        mockGet.mockClear();
        const response = await serveImageFromR2(env, path, corsHeaders);
        expect(response.headers.get('Content-Type')).toBe(expected);
      }
    });
  });
});