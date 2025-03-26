export class BackendService {
    /**
     * Handles an HTTP request by processing it with the provided handler function
     * and wrapping the response or error in a standardized format.
     * 
     * @param {Request} request - The incoming HTTP request object
     * @param {Function} handler - A function that processes the request and returns a response
     * @returns {Response} A Response object with JSON content containing a success flag and either:
     *                    - The response data from the handler (on success)
     *                    - An error message (on failure)
     * @throws {never} This method catches all errors and returns them as Response objects
     */
    static async handleRequest(request, handler) {
        // Common headers for all responses
        const headers = {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        };
        
        // Handle preflight OPTIONS request
        if (request.method === "OPTIONS") {
            return new Response(null, { headers, status: 200 });
        }
        
        try {
            // Use the handler to process the request
            const response = await handler(request);
            return new Response(JSON.stringify({ success: true, ...response }), {
                headers
            });
        } catch (error) {
            return new Response(JSON.stringify({ success: false, error: error.message }), {
                status: 500,
                headers
            });
        }
    }
  
    /**
     * Parses the request body based on the content-type header.
     * 
     * @async
     * @param {Request} request - The incoming request object
     * @returns {Promise<Object>} The parsed request data as an object
     * @throws {Error} If the content-type is not supported (neither JSON nor form data)
     */
    static async parseRequest(request) {
        const contentType = request.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            return await request.json();
        } else if (contentType.includes("application/x-www-form-urlencoded")) {
            const formData = await request.formData();
            const data = {};
            formData.forEach((value, key) => {
                data[key] = value;
            });
            return data;
        }
        throw new Error("Unsupported content type");
    }
}