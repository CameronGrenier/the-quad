import formDataUtil from './formData';

// Mock Request and FormData
global.FormData = class FormData {
  constructor() {
    this.data = {};
  }
  
  append(key, value) {
    this.data[key] = value;
  }
  
  get(key) {
    return this.data[key] || null;
  }
  
  has(key) {
    return key in this.data;
  }
};

function createMockRequest(body, contentType) {
  return {
    headers: {
      get: jest.fn().mockImplementation((name) => {
        if (name.toLowerCase() === 'content-type') {
          return contentType;
        }
        return null;
      })
    },
    formData: jest.fn().mockResolvedValue(new FormData()),
    json: jest.fn().mockResolvedValue(body)
  };
}

describe('FormDataUtil', () => {
  describe('parseFormData', () => {
    test('should handle multipart/form-data', async () => {
      const mockRequest = createMockRequest({}, 'multipart/form-data; boundary=something');
      const formData = await formDataUtil.parseFormData(mockRequest);
      
      expect(mockRequest.formData).toHaveBeenCalled();
      expect(formData).toBeTruthy();
    });
    
    test('should handle application/x-www-form-urlencoded', async () => {
      const mockRequest = createMockRequest({}, 'application/x-www-form-urlencoded');
      const formData = await formDataUtil.parseFormData(mockRequest);
      
      expect(mockRequest.formData).toHaveBeenCalled();
      expect(formData).toBeTruthy();
    });
    
    test('should handle application/json', async () => {
      const jsonData = { name: 'Test', value: 123 };
      const mockRequest = createMockRequest(jsonData, 'application/json');
      const formData = await formDataUtil.parseFormData(mockRequest);
      
      expect(mockRequest.json).toHaveBeenCalled();
      expect(formData).toBeTruthy();
    });
    
    test('should return empty FormData for unsupported content type', async () => {
      const mockRequest = createMockRequest({}, 'text/plain');
      const formData = await formDataUtil.parseFormData(mockRequest);
      
      expect(formData).toBeInstanceOf(FormData);
    });
  });
  
  describe('getFormValue', () => {
    test('should return string value by default', () => {
      const formData = new FormData();
      formData.append('name', 'Test');
      
      const result = formDataUtil.getFormValue(formData, 'name');
      expect(result).toBe('Test');
    });
    
    test('should convert to number', () => {
      const formData = new FormData();
      formData.append('value', '123');
      
      const result = formDataUtil.getFormValue(formData, 'value', 'number');
      expect(result).toBe(123);
    });
    
    test('should convert to boolean', () => {
      const formData = new FormData();
      formData.append('active', 'true');
      
      const result = formDataUtil.getFormValue(formData, 'active', 'boolean');
      expect(result).toBe(true);
    });
    
    test('should return default value if key not found', () => {
      const formData = new FormData();
      
      const result = formDataUtil.getFormValue(formData, 'missing', 'string', 'default');
      expect(result).toBe('default');
    });
  });
});