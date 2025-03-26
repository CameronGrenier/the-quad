import { uploadFileToR2, serveImageFromR2 } from '../../client/src/utils/storage.js';

describe('Storage Utilities', () => {
  describe('uploadFileToR2', () => {
    test('should upload file to R2 and return path', async () => {
      // Create a mock file
      const file = new File(['test file content'], 'test.jpg', { type: 'image/jpeg' });
      
      // Create a mock env
      const mockR2Put = jest.fn().mockResolvedValue({});
      const env = {
        R2_BUCKET: {
          put: mockR2Put
        }
      };
      
      const path = 'uploads/test.jpg';
      const result = await uploadFileToR2(env, file, path);
      
      // Assertions
      expect(mockR2Put).toHaveBeenCalled();
      expect(result).toBe('/images/uploads/test.jpg');
    });
    
    test('should throw error if R2_BUCKET is missing', async () => {
      // Create a mock file
      const file = new File(['test file content'], 'test.jpg', { type: 'image/jpeg' });
      
      // Create a mock env without R2_BUCKET
      const env = {};
      
      const path = 'uploads/test.jpg';
      
      // Assertions
      await expect(uploadFileToR2(env, file, path)).rejects.toThrow('Missing R2_BUCKET binding');
    });
  });
  
  describe('serveImageFromR2', () => {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*'
    };
    
    test('should serve image file from R2 with correct content type', async () => {
      // Create a mock env
      const mockObject = {
        body: 'mocked image data'
      };
      const mockR2Get = jest.fn().mockResolvedValue(mockObject);
      const env = {
        R2_BUCKET: {
          get: mockR2Get
        }
      };
      
      const imagePath = 'test.jpg';
      const response = await serveImageFromR2(env, imagePath, corsHeaders);
      
      // Assertions
      expect(mockR2Get).toHaveBeenCalledWith(imagePath);
      expect(response.headers.get('Content-Type')).toBe('image/jpeg');
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
    
    test('should return 404 if image not found', async () => {
      // Create a mock env
      const mockR2Get = jest.fn().mockResolvedValue(null);
      const env = {
        R2_BUCKET: {
          get: mockR2Get
        }
      };
      
      const imagePath = 'nonexistent.jpg';
      const response = await serveImageFromR2(env, imagePath, corsHeaders);
      
      // Assertions
      expect(mockR2Get).toHaveBeenCalledWith(imagePath);
      expect(response.status).toBe(404);
    });
  });
});