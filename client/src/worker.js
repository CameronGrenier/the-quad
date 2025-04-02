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
    
    // Handle image requests
    if (path.startsWith("/images/") || path.includes("profile_pictures")) {
      try {
        console.log(`Image requested: ${path}`);
        
        // Remove the leading "/images/" if present to get the storage key
        const objectKey = path.startsWith("/images/") ? path.substring(8) : path;
        console.log(`Looking for R2 object with key: ${objectKey}`);
        
        // Check if we have R2 bucket binding
        if (!env.R2_BUCKET) {
          console.error("R2_BUCKET binding is missing");
          throw new Error("Storage configuration error");
        }
        
        // Get the object from R2
        const object = await env.R2_BUCKET.get(objectKey);
        
        if (object === null) {
          console.log(`Object ${objectKey} not found in R2 bucket`);
          
          // Fall back to a placeholder
          const filename = path.split('/').pop();
          const svgPlaceholder = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">
            <rect width="150" height="150" fill="#e0e0e0"/>
            <text x="75" y="65" font-size="16" text-anchor="middle" fill="#555">Image</text>
            <text x="75" y="85" font-size="12" text-anchor="middle" fill="#777">${filename}</text>
          </svg>`;
          
          return new Response(svgPlaceholder, { 
            status: 404, // Use 404 to indicate the actual image wasn't found
            headers: { 
              "Content-Type": "image/svg+xml", 
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "max-age=60" // Short cache for placeholders
            }
          });
        }
        
        // Determine content type based on file extension
        const extension = objectKey.split('.').pop().toLowerCase();
        let contentType = "application/octet-stream";
        
        // Set content type based on file extension
        if (extension === "jpg" || extension === "jpeg") contentType = "image/jpeg";
        else if (extension === "png") contentType = "image/png";
        else if (extension === "gif") contentType = "image/gif";
        else if (extension === "svg") contentType = "image/svg+xml";
        
        // Use the content type from R2 if available
        if (object.httpMetadata?.contentType) {
          contentType = object.httpMetadata.contentType;
        }
        
        console.log(`Serving ${objectKey} as ${contentType}`);
        
        // Return the image with proper headers
        return new Response(object.body, { 
          status: 200,
          headers: { 
            "Content-Type": contentType, 
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=86400", // Cache for 24 hours
            "Content-Length": object.size
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
      if (path === "/api/user-profile" && request.method === "GET") {
        return BackendService.handleRequest(request, (req) => accountCtrl.getUserProfile(req));
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