import BackendService from './BackendService';

// Mock global objects that might be missing in Jest's jsdom environment
global.ReadableStream = class MockReadableStream {};
global.ArrayBuffer = ArrayBuffer || class MockArrayBuffer {};
global.File = File || class MockFile {
  constructor(parts, name, options = {}) {
    this.name = name;
    this.type = options.type || '';
    this.size = 0;
  }
  arrayBuffer() {
    return Promise.resolve(new ArrayBuffer(0));
  }
};

// Add Response mock
global.Response = class Response {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.headers = new Map();
    if (init.headers) {
      Object.entries(init.headers).forEach(([key, value]) => {
        this.headers.set(key, value);
      });
    }
  }
  
  get(name) {
    return this.headers.get(name);
  }
};

// Mock data and helpers
const mockFile = (data, name, type) => {
  const file = new File([data], name, { type });
  file.arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(8));
  return file;
};

// Mock environment setup
function createMockEnv() {
  // Mock database
  const mockDb = {
    prepare: jest.fn().mockImplementation((query) => {
      const mockStatement = {
        bind: jest.fn().mockReturnThis(),
        run: jest.fn().mockResolvedValue({ meta: { last_row_id: 123 } }),
        first: jest.fn().mockResolvedValue({ id: 1, name: 'Test User' }),
        all: jest.fn().mockResolvedValue({ results: [{ id: 1, name: 'Test User' }] }),
      };
      return mockStatement;
    }),
    batch: jest.fn().mockResolvedValue({ success: true }),
  };

  // Mock R2 Bucket
  const mockR2Bucket = {
    put: jest.fn().mockResolvedValue({}),
    get: jest.fn().mockImplementation((path) => {
      if (path === 'notfound.jpg') {
        return Promise.resolve(null);
      }
      return Promise.resolve({
        body: new ReadableStream(),
      });
    }),
  };

  return {
    D1_DB: mockDb,
    R2_BUCKET: mockR2Bucket,
  };
}

describe('BackendService', () => {
  let service;
  let mockEnv;

  beforeEach(() => {
    mockEnv = createMockEnv();
    service = new BackendService(mockEnv);
  });

  describe('constructor', () => {
    it('should initialize with environment variables', () => {
      expect(service.env).toBe(mockEnv);
      expect(service.db).toBe(mockEnv.D1_DB);
      expect(service.r2Bucket).toBe(mockEnv.R2_BUCKET);
    });
  });

  describe('uploadFile', () => {
    it('should throw an error if R2_BUCKET is missing', async () => {
      service.r2Bucket = null;
      await expect(service.uploadFile({}, 'test.jpg')).rejects.toThrow('Missing R2_BUCKET binding');
    });

    it('should sanitize and upload a file', async () => {
      const file = mockFile('test data', 'test file.jpg', 'image/jpeg');
      const result = await service.uploadFile(file, 'user/test file!@#.jpg');
      
      expect(service.r2Bucket.put).toHaveBeenCalled();
      expect(result).toContain('/images/user/test_file.jpg');
    });

    it('should handle files without path', async () => {
      const file = mockFile('test data', 'test.jpg', 'image/jpeg');
      const result = await service.uploadFile(file, 'test.jpg');
      
      expect(service.r2Bucket.put).toHaveBeenCalled();
      expect(result).toBe('/images/test.jpg');
    });
  });

  describe('serveImage', () => {
    it('should serve an image when found', async () => {
      const corsHeaders = { 'Access-Control-Allow-Origin': '*' };
      const response = await service.serveImage('test.jpg', corsHeaders);
      
      expect(response).toBeInstanceOf(Response);
      expect(response.headers.get('Content-Type')).toBe('image/jpeg');
    });

    it('should return 404 when image not found', async () => {
      const corsHeaders = { 'Access-Control-Allow-Origin': '*' };
      const response = await service.serveImage('notfound.jpg', corsHeaders);
      
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(404);
    });

    it('should try alternative path when image not found initially', async () => {
      // First get returns null, second one succeeds
      service.r2Bucket.get = jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ body: new ReadableStream() });
        
      const corsHeaders = { 'Access-Control-Allow-Origin': '*' };
      const response = await service.serveImage('path/to/image.png', corsHeaders);
      
      expect(service.r2Bucket.get).toHaveBeenCalledTimes(2);
      expect(response.headers.get('Content-Type')).toBe('image/png');
    });
  });

  describe('sanitizeFileName', () => {
    it('should replace spaces with underscores', () => {
      expect(service.sanitizeFileName('test file.jpg')).toBe('test_file.jpg');
    });

    it('should remove special characters', () => {
      expect(service.sanitizeFileName('test!@#$%.jpg')).toBe('test.jpg');
    });

    it('should replace accented characters', () => {
      expect(service.sanitizeFileName('téstïng.jpg')).toBe('testing.jpg');
    });
  });

  describe('query', () => {
    it('should execute a query with parameters', async () => {
      const result = await service.query('INSERT INTO users VALUES (?, ?)', [1, 'Test']);
      
      expect(service.db.prepare).toHaveBeenCalledWith('INSERT INTO users VALUES (?, ?)');
      expect(result.meta.last_row_id).toBe(123);
    });
  });

  describe('queryFirst', () => {
    it('should return the first row', async () => {
      const result = await service.queryFirst('SELECT * FROM users WHERE id = ?', [1]);
      
      expect(service.db.prepare).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?');
      expect(result).toEqual({ id: 1, name: 'Test User' });
    });
  });

  describe('queryAll', () => {
    it('should return all rows', async () => {
      const result = await service.queryAll('SELECT * FROM users');
      
      expect(service.db.prepare).toHaveBeenCalledWith('SELECT * FROM users');
      expect(result.results).toEqual([{ id: 1, name: 'Test User' }]);
    });
  });

  describe('executeBatch', () => {
    it('should execute a batch of statements', async () => {
      const statements = [
        { query: 'INSERT INTO users VALUES (?, ?)', params: [1, 'Test'] },
        { query: 'UPDATE users SET name = ?', params: ['Updated'] }
      ];
      
      const result = await service.executeBatch(statements);
      
      expect(service.db.batch).toHaveBeenCalledWith(statements);
      expect(result).toEqual({ success: true });
    });
  });

  describe('prepareBatch', () => {
    it('should prepare a batch of statements', () => {
      const queryParamsPairs = [
        ['INSERT INTO users VALUES (?, ?)', [1, 'Test']],
        ['UPDATE users SET name = ?', ['Updated']]
      ];
      
      const result = service.prepareBatch(queryParamsPairs);
      
      expect(result).toHaveLength(2);
      expect(service.db.prepare).toHaveBeenCalledTimes(2);
    });
  });
});