/**
 * Executes a query that returns rows
 * @param {Object} env - The environment object containing DB bindings
 * @param {string} sql - The SQL query to execute
 * @param {Array} params - The parameters for the query
 * @returns {Promise<Array>} - The results of the query
 */
export async function query(env, sql, params = []) {
    try {
        // Add debugging to see what's available in env
        console.log("Environment keys:", Object.keys(env));
        console.log("D1_DB exists:", env.D1_DB !== undefined);
        
        // Safely access the database
        const db = env.D1_DB;
        if (!db) {
            throw new Error("Database binding 'D1_DB' is not available in the environment");
        }
        
        const { results } = await db.prepare(sql).bind(...params).all();
        return results || [];
    } catch (error) {
        console.error("Database query error:", error);
        throw new Error(`Database error: ${error.message}`);
    }
}

/**
 * Executes a query that doesn't return rows (INSERT, UPDATE, DELETE)
 * @param {Object} env - The environment object containing DB bindings
 * @param {string} sql - The SQL query to execute
 * @param {Array} params - The parameters for the query
 * @returns {Promise<Object>} - The results with metadata
 */
export async function execute(env, sql, params = []) {
    try {
        // Add debugging
        console.log("Environment keys in execute:", Object.keys(env));
        console.log("D1_DB exists in execute:", env.D1_DB !== undefined);
        
        const db = env.D1_DB;
        if (!db) {
            throw new Error("Database binding 'D1_DB' is not available in the environment");
        }
        
        const result = await db.prepare(sql).bind(...params).run();
        return result;
    } catch (error) {
        console.error("Database execution error:", error);
        throw new Error(`Database error: ${error.message}`);
    }
}