import { parseFormData } from '../../client/src/utils/formData.js';

describe('FormData Utilities', () => {
  test('parseFormData should handle multipart/form-data', async () => {
    const formData = new FormData();
    formData.append('name', 'Test Organization');
    formData.append('description', 'Test Description');
    
    const request = new Request('https://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
    });
    
    // Mock the formData method
    request.formData = jest.fn().mockResolvedValue(formData);
    
    const result = await parseFormData(request);
    expect(result.get('name')).toBe('Test Organization');
    expect(result.get('description')).toBe('Test Description');
    expect(request.formData).toHaveBeenCalled();
  });
  
  test('parseFormData should handle application/json', async () => {
    const jsonData = {
      name: 'Test Organization',
      description: 'Test Description',
    };
    
    const request = new Request('https://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(jsonData),
    });
    
    // Mock the json method
    request.json = jest.fn().mockResolvedValue(jsonData);
    
    const result = await parseFormData(request);
    expect(result.get('name')).toBe('Test Organization');
    expect(result.get('description')).toBe('Test Description');
    expect(request.json).toHaveBeenCalled();
  });
  
  test('parseFormData should return empty FormData for unsupported content-type', async () => {
    const request = new Request('https://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: 'Plain text',
    });
    
    const result = await parseFormData(request);
    expect(result instanceof FormData).toBe(true);
  });
});