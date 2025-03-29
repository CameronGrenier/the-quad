export class BackendService {
  static async handleRequest(request, handler) {
    const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers, status: 200 });
    }

    try {
      const handlerResponse = await handler(request);
      
      // If handlerResponse is already a Response object, return it directly
      if (handlerResponse instanceof Response) {
        return handlerResponse;
      }
      
      // Otherwise, convert to standard response format
      return new Response(JSON.stringify(handlerResponse), { headers });
    } catch (error) {
      console.error("Request handler error:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers }
      );
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

// Export standalone aliases for easier import
export const handleRequest = BackendService.handleRequest;
export const parseRequest = BackendService.parseRequest;