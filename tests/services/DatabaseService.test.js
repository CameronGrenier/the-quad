import { jest } from '@jest/globals';
import { DatabaseService } from '../../client/src/services/DatabaseService.js';

describe('DatabaseService', () => {
  // Common mock setup
  let mockD1Binding;
  let mockPrepare;
  let mockBind;
  let mockAll;
  let mockRun;
  let env;

  beforeEach(() => {
    // Set up mock D1 database binding and chain of method calls
    mockAll = jest.fn();
    mockRun = jest.fn();
    mockBind = jest.fn().mockImplementation(() => ({
      all: mockAll,
      run: mockRun
    }));
    mockPrepare = jest.fn().mockImplementation(() => ({
      bind: mockBind
    }));
    mockD1Binding = {
      prepare: mockPrepare
    };
    env = { D1_DB: mockD1Binding };
  });

  describe('query', () => {
    test('should execute query and return results', async () => {
      // Arrange
      const expectedResults = [{ id: 1, name: 'Test' }, { id: 2, name: 'Test2' }];
      mockAll.mockResolvedValue({ results: expectedResults });

      // Act
      const results = await DatabaseService.query(env, 'SELECT * FROM test WHERE id = ?', [1]);

      // Assert
      expect(mockPrepare).toHaveBeenCalledWith('SELECT * FROM test WHERE id = ?');
      expect(mockBind).toHaveBeenCalledWith(1);
      expect(mockAll).toHaveBeenCalled();
      expect(results).toEqual(expectedResults);
    });

    test('should handle empty result sets', async () => {
      // Arrange
      mockAll.mockResolvedValue({ results: [] });

      // Act
      const results = await DatabaseService.query(env, 'SELECT * FROM test WHERE id = ?', [999]);

      // Assert
      expect(results).toEqual([]);
    });

    test('should handle query with no parameters', async () => {
      // Arrange
      const expectedResults = [{ count: 5 }];
      mockAll.mockResolvedValue({ results: expectedResults });

      // Act
      const results = await DatabaseService.query(env, 'SELECT COUNT(*) AS count FROM test');

      // Assert
      expect(mockBind).toHaveBeenCalledWith();
      expect(results).toEqual(expectedResults);
    });

    test('should throw error when query fails', async () => {
      // Arrange
      mockAll.mockRejectedValue(new Error('SQL syntax error'));

      // Act & Assert
      await expect(DatabaseService.query(env, 'INVALID SQL'))
        .rejects
        .toThrow('Database query failed: SQL syntax error');
    });

    test('should throw error when D1_DB binding is missing', async () => {
      // Arrange
      const invalidEnv = {};

      // Act & Assert
      await expect(DatabaseService.query(invalidEnv, 'SELECT * FROM test'))
        .rejects
        .toThrow(/Database query failed/);
    });
  });

  describe('execute', () => {
    test('should execute statement and return result', async () => {
      // Arrange
      const expectedResult = { 
        success: true, 
        meta: { 
          changes: 1, 
          duration: 10, 
          last_row_id: 42 
        }
      };
      mockRun.mockResolvedValue(expectedResult);

      // Act
      const result = await DatabaseService.execute(
        env, 
        'INSERT INTO test (name) VALUES (?)',
        ['New Test']
      );

      // Assert
      expect(mockPrepare).toHaveBeenCalledWith('INSERT INTO test (name) VALUES (?)');
      expect(mockBind).toHaveBeenCalledWith('New Test');
      expect(mockRun).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });

    test('should execute update statement', async () => {
      // Arrange
      const expectedResult = { success: true, meta: { changes: 1 } };
      mockRun.mockResolvedValue(expectedResult);

      // Act
      const result = await DatabaseService.execute(
        env, 
        'UPDATE test SET name = ? WHERE id = ?',
        ['Updated Name', 1]
      );

      // Assert
      expect(mockPrepare).toHaveBeenCalledWith('UPDATE test SET name = ? WHERE id = ?');
      expect(mockBind).toHaveBeenCalledWith('Updated Name', 1);
      expect(result).toEqual(expectedResult);
    });

    test('should execute delete statement', async () => {
      // Arrange
      const expectedResult = { success: true, meta: { changes: 1 } };
      mockRun.mockResolvedValue(expectedResult);

      // Act
      const result = await DatabaseService.execute(
        env, 
        'DELETE FROM test WHERE id = ?',
        [1]
      );

      // Assert
      expect(mockPrepare).toHaveBeenCalledWith('DELETE FROM test WHERE id = ?');
      expect(mockBind).toHaveBeenCalledWith(1);
      expect(result).toEqual(expectedResult);
    });

    test('should throw error when execution fails', async () => {
      // Arrange
      mockRun.mockRejectedValue(new Error('Constraint violation'));

      // Act & Assert
      await expect(DatabaseService.execute(
        env, 
        'INSERT INTO test (id, name) VALUES (?, ?)',
        [1, 'Duplicate Key']
      ))
        .rejects
        .toThrow('Database execution failed: Constraint violation');
    });

    test('should throw error when D1_DB binding is missing', async () => {
      // Arrange
      const invalidEnv = {};

      // Act & Assert
      await expect(DatabaseService.execute(
        invalidEnv, 
        'INSERT INTO test (name) VALUES (?)',
        ['Test']
      ))
        .rejects
        .toThrow(/Database execution failed/);
    });
  });
});