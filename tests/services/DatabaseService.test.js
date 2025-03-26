import { DatabaseService } from '../../client/src/services/DatabaseService.js';

describe('DatabaseService', () => {
  describe('query', () => {
    test('should execute a query and return results', async () => {
      // Mock D1 environment
      const mockResults = [{ id: 1, name: 'Test' }];
      const mockAll = jest.fn().mockResolvedValue({ results: mockResults });
      const mockBind = jest.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = jest.fn().mockReturnValue({ bind: mockBind });
      
      const mockEnv = {
        D1_DB: {
          prepare: mockPrepare
        }
      };

      const sql = 'SELECT * FROM table WHERE id = ?';
      const params = [1];
      
      const results = await DatabaseService.query(mockEnv, sql, params);
      
      expect(mockPrepare).toHaveBeenCalledWith(sql);
      expect(mockBind).toHaveBeenCalled();
      expect(mockAll).toHaveBeenCalled();
      expect(results).toEqual(mockResults);
    });

    test('should handle query errors', async () => {
      // Mock D1 environment with error
      const mockBind = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });
      
      const mockPrepare = jest.fn().mockReturnValue({ bind: mockBind });
      
      const mockEnv = {
        D1_DB: {
          prepare: mockPrepare
        }
      };

      const sql = 'INVALID SQL';
      
      await expect(DatabaseService.query(mockEnv, sql)).rejects.toThrow('Database query failed: Database error');
    });
  });

  describe('execute', () => {
    test('should execute a statement and return result', async () => {
      // Mock result
      const mockResult = { meta: { last_row_id: 123 } };
      const mockRun = jest.fn().mockResolvedValue(mockResult);
      const mockBind = jest.fn().mockReturnValue({ run: mockRun });
      const mockPrepare = jest.fn().mockReturnValue({ bind: mockBind });
      
      const mockEnv = {
        D1_DB: {
          prepare: mockPrepare
        }
      };

      const sql = 'INSERT INTO table (name) VALUES (?)';
      const params = ['Test'];
      
      const result = await DatabaseService.execute(mockEnv, sql, params);
      
      expect(mockPrepare).toHaveBeenCalledWith(sql);
      expect(mockBind).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    test('should handle execution errors', async () => {
      // Mock D1 environment with error
      const mockBind = jest.fn().mockImplementation(() => {
        throw new Error('Execution error');
      });
      
      const mockPrepare = jest.fn().mockReturnValue({ bind: mockBind });
      
      const mockEnv = {
        D1_DB: {
          prepare: mockPrepare
        }
      };

      const sql = 'INVALID SQL';
      
      await expect(DatabaseService.execute(mockEnv, sql)).rejects.toThrow('Database execution failed: Execution error');
    });
  });
});