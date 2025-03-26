class DatabaseService {
    /**
     * Executes a SQL query against the D1 database.
     * 
     * @param {Object} env - The environment object containing the D1_DB instance.
     * @param {string} sql - The SQL query to execute.
     * @param {Array} [params=[]] - Optional array of parameters to bind to the query.
     * @returns {Promise<Array>} A promise that resolves to the query results.
     * @throws {Error} If the database query fails, with the error message.
     * @static
     * @async
     */
    static async query(env, sql, params = []) {
      try {
        const statement = env.D1_DB.prepare(sql);
        params.forEach((param, index) => {
          statement.bind(param, index + 1);
        });
        const { results } = await statement.all();
        return results;
      } catch (error) {
        throw new Error(`Database query failed: ${error.message}`);
      }
    }
  
    /**
     * Executes a SQL statement with prepared parameters on the D1 database.
     * 
     * @param {Object} env - The environment object containing the D1 database instance
     * @param {string} sql - The SQL statement to execute
     * @param {Array} [params=[]] - Array of parameters to bind to the SQL statement
     * @returns {Promise<Object>} - Result of the database query execution
     * @throws {Error} - If the database execution fails
     * @static
     * @async
     */
    static async execute(env, sql, params = []) {
      try {
        const statement = env.D1_DB.prepare(sql);
        params.forEach((param, index) => {
          statement.bind(param, index + 1);
        });
        const result = await statement.run();
        return result;
      } catch (error) {
        throw new Error(`Database execution failed: ${error.message}`);
      }
    }
  }