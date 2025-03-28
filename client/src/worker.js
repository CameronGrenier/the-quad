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
}