/**
 * The Quad - University Event Planner - Cloudflare Worker (Object Oriented)
 *
 * Domain classes represent the data model while controller classes encapsulate
 * the API endpoint logic.
 */



import { 
  AccountController,
  OrganizationController,
  EventController,  
  OfficialStatusController,
  // AdminDashboardController 
} from './controllers/index.js';

import * as DatabaseService from './services/DatabaseService.js';
import * as BackendService from './services/BackendService.js';
import { verifyJWT } from './utils/auth.js';
import { hashPassword } from './utils/auth.js';


/* ==================== MAIN WORKER FUNCTION ==================== */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "application/json"
    };

    // Handle OPTIONS requests explicitly
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

    // Instantiate controllers with environment
    const accountCtrl = new AccountController(env, corsHeaders);
    const orgCtrl = new OrganizationController(env, corsHeaders);
    const eventCtrl = new EventController(env, corsHeaders);
    const officialStatusCtrl = new OfficialStatusController(env, corsHeaders);
    // const adminDashboard = new AdminDashboardController(env, corsHeaders);

    try {
      // Authentication endpoints
      if (path === "/api/signup" && request.method === "POST") {
        return BackendService.handleRequest(request, (req) => accountCtrl.createAccount(req));
      }
      if (path === "/api/login" && request.method === "POST") {
        // Direct call to login without wrapping it in handleRequest again
        // since login already has handling built in
        return accountCtrl.login(request);
      }
      if (path === "/api/user-profile") {
        try {
          // Extract JWT token from Authorization header
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
              status: 401,
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
          }

          const token = authHeader.split(' ')[1];
          const jwtSecret = env.JWT_SECRET || "4ce3238e21b48e1c8b056561365ff037dbdcf0664587d3408a7196d772e29475";
          
          console.log("Verifying token for user-profile...");
          const payload = await verifyJWT(token, jwtSecret);
          const userId = payload.userId || payload.userID;
          
          console.log("User ID from token:", userId);
          
          if (!userId) {
            console.log("No user ID found in token");
            return new Response(JSON.stringify({ success: false, error: 'Invalid token' }), {
              status: 400,
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
          }

          // Query user data
          const users = await DatabaseService.query(env,
            `SELECT userID, username, f_name, l_name, email, phone, profile_picture 
             FROM USERS WHERE userID = ?`,
            [userId]
          );
          
          console.log("Database query result:", users);

          if (users.length === 0) {
            return new Response(JSON.stringify({ success: false, error: 'User not found' }), {
              status: 404,
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
          }

          // Return user data
          return new Response(JSON.stringify({
            success: true,
            user: {
              id: users[0].userID,
              userID: users[0].userID,
              username: users[0].username,
              f_name: users[0].f_name,
              l_name: users[0].l_name,
              email: users[0].email,
              phone: users[0].phone,
              profile_picture: users[0].profile_picture
            }
          }), {
            status: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        } catch (error) {
          console.error("User profile error:", error);
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }
      }

      // Organization endpoints
      if (path === "/api/register-organization" && request.method === "POST") {
        return BackendService.handleRequest(request, (req) => orgCtrl.registerOrganization(req));
      }
      if (path === "/api/user-organizations" && request.method === "GET") {
        return BackendService.handleRequest(request, (req) => orgCtrl.getUserOrganizations(req));
      }
      if (path === "/api/organizations" && request.method === "GET") {
        return BackendService.handleRequest(request, (req) => orgCtrl.getAllOrganizations(req));
      }
      if (path.match(/^\/api\/organizations\/\d+$/) && request.method === "GET") {
        const orgId = parseInt(path.split("/").pop());
        return BackendService.handleRequest(request, (req) => orgCtrl.getOrganization(req, orgId));
      }
      if (path.match(/^\/api\/organizations\/\d+\/events$/)) {
        const parts = path.split("/");
        const orgId = parseInt(parts[3]);
        return BackendService.handleRequest(request, (req) => orgCtrl.getOrganizationEvents(req, orgId));
      }
      if (path.match(/^\/api\/organizations\/\d+$/) && request.method === "DELETE") {
        const orgId = parseInt(path.split("/").pop());
        return BackendService.handleRequest(request, (req) => orgCtrl.deleteOrganization(req, orgId));
      }

      // Event endpoints
      if (path === "/api/register-event" && request.method === "POST") {
        return BackendService.handleRequest(request, (req) => eventCtrl.registerEvent(req));
      }
      if (path === "/api/events" && request.method === "GET") {
        return BackendService.handleRequest(request, (req) => eventCtrl.getAllEvents(req));
      }

      if (path === "/api/user/events") {
        try {
          // Extract JWT token from Authorization header
          const authHeader = request.headers.get('Authorization');
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
              status: 401,
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
          }

          const token = authHeader.split(' ')[1];
          const jwtSecret = env.JWT_SECRET || "4ce3238e21b48e1c8b056561365ff037dbdcf0664587d3408a7196d772e29475";
          const payload = await verifyJWT(token, jwtSecret);
          const userId = payload.userId || payload.userID;

          if (!userId) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid token' }), {
              status: 400,
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
          }

          // For now, return an empty array
          // Later you can implement the actual database query for user events
          return new Response(JSON.stringify({
            success: true,
            events: []
          }), {
            status: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        } catch (error) {
          console.error("User events error:", error);
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }
      }

      // Add this route to handle image serving
      if (path.startsWith("/images/") || path.includes("profile_pictures")) {
        try {
          console.log(`Image requested: ${path}`);
          
          // Make a more visually appealing SVG placeholder with the path displayed
          const filename = path.split('/').pop();
          const svgPlaceholder = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">
            <rect width="150" height="150" fill="#e0e0e0"/>
            <text x="75" y="65" font-size="16" text-anchor="middle" fill="#555">Image</text>
            <text x="75" y="85" font-size="12" text-anchor="middle" fill="#777">${filename}</text>
          </svg>`;
          
          return new Response(svgPlaceholder, { 
            status: 200,
            headers: { 
              "Content-Type": "image/svg+xml", 
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "max-age=3600"
            }
          });
        } catch (error) {
          console.error(`Error serving image: ${error.message}`);
          return new Response(`Error serving image: ${error.message}`, { 
            status: 500,
            headers: { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" }
          });
        }
      }

      // Test DB connection endpoint
      if (path === "/api/test-db") {
        try {
          console.log("Testing DB connection");
          console.log("Environment keys:", Object.keys(env));
          console.log("D1_DB exists:", env.D1_DB !== undefined);
          
          if (!env.D1_DB) {
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: "D1_DB binding not found",
                availableKeys: Object.keys(env)
              }),
              { 
                status: 500, 
                headers: { 
                  "Content-Type": "application/json",
                  "Access-Control-Allow-Origin": "*"
                } 
              }
            );
          }
          
          const { results } = await env.D1_DB.prepare("SELECT 1 as test").all();
          return new Response(
            JSON.stringify({ success: true, results }),
            { 
              status: 200, 
              headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
              } 
            }
          );
        } catch (error) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: error.message, 
              stack: error.stack,
              type: error.constructor.name
            }),
            { 
              status: 500, 
              headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
              } 
            }
          );
        }
      }

      // Default 404 Not Found
      return new Response(JSON.stringify({ error: "Not found" }), { 
        status: 404, 
        headers: { 
          "Content-Type": "application/json", 
          "Access-Control-Allow-Origin": "*" 
        } 
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: "Server error", message: error.message }), { 
        status: 500, 
        headers: { 
          "Content-Type": "application/json", 
          "Access-Control-Allow-Origin": "*" 
        } 
      });
    }
  }
};

/* ==================== UTILITY FUNCTIONS: Database Schema Management ==================== */
// place utility functions here !