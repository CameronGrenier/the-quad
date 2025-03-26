/**
 * Database service to handle common database operations.
 */
export class DatabaseService {
  /**
   * Execute a query and return multiple results.
   * 
   * @param {Object} env - Environment with D1 database binding
   * @param {string} query - SQL query string
   * @param {Array} params - Array of parameters to bind to the query
   * @returns {Promise<Array>} - Array of query results
   */
  static async query(env, query, params = []) {
    try {
      const statement = env.D1_DB.prepare(query);
      const boundStatement = statement.bind(...params);
      const result = await boundStatement.all();
      return result.results || [];
    } catch (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }
  }
  
  /**
   * Execute a statement that modifies the database.
   * 
   * @param {Object} env - Environment with D1 database binding
   * @param {string} query - SQL statement string
   * @param {Array} params - Array of parameters to bind to the statement
   * @returns {Promise<Object>} - Result object from D1
   */
  static async execute(env, query, params = []) {
    try {
      const statement = env.D1_DB.prepare(query);
      const boundStatement = statement.bind(...params);
      return await boundStatement.run();
    } catch (error) {
      throw new Error(`Database execution failed: ${error.message}`);
    }
  }
}