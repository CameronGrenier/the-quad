/**
 * The Quad - University Event Planner - Cloudflare Worker (Modular Architecture)
 */

// Import utility functions
import { parseFormData } from './utils/formData.js';
import { generateJWT, hashPassword, verifyPassword, verifyJWT } from './utils/auth.js';
import { uploadFileToR2, serveImageFromR2 } from './utils/storage.js';

// Import controllers
import { AccountController } from './controllers/AccountController.js';
import { OrganizationController } from './controllers/OrganizationController.js';
import { EventController } from './controllers/EventController.js';
import { OfficialStatusController } from './controllers/OfficialStatusController.js';
import { AdminDashboard } from './controllers/AdminDashboardController.js';

/* ==================== MAIN WORKER FUNCTION ==================== */
export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "application/json"
    };
    
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    
    const url = new URL(request.url);
    const path = url.pathname;

    // Instantiate controllers with environment and headers
    const accountCtrl = new AccountController(env, corsHeaders);
    const orgCtrl = new OrganizationController(env, corsHeaders);
    const eventCtrl = new EventController(env, corsHeaders);
    const officialStatusCtrl = new OfficialStatusController(env, corsHeaders);
    const adminDashboard = new AdminDashboard(env, corsHeaders);

    try {
      // Authentication endpoints
      if (path === "/api/signup" && request.method === "POST") {
        return await accountCtrl.createAccount(request);
      }
      if (path === "/api/login" && request.method === "POST") {
        return await accountCtrl.login(request);
      }
      if (path === "/api/user-profile" && request.method === "GET") {
        return await accountCtrl.getUserProfile(request);
      }

      // Validation endpoints
      if (path === "/api/check-email" && request.method === "GET") {
        const email = new URL(request.url).searchParams.get('email');
        const { results } = await env.D1_DB.prepare(
          "SELECT * FROM USERS WHERE LOWER(email)=LOWER(?)"
        ).bind(email).all();
        return new Response(JSON.stringify({ success: true, exists: (results && results.length > 0) }), { headers: corsHeaders });
      }
      if (path === "/api/check-organization-name" && request.method === "GET") {
        const name = new URL(request.url).searchParams.get('name');
        const { results } = await env.D1_DB.prepare(
          "SELECT * FROM ORGANIZATION WHERE LOWER(name)=LOWER(?)"
        ).bind(name).all();
        return new Response(JSON.stringify({ success: true, exists: (results && results.length > 0) }), { headers: corsHeaders });
      }

      // Organization endpoints
      if (path === "/api/register-organization" && request.method === "POST") {
        return await orgCtrl.registerOrganization(request);
      }
      if (path === "/api/user-organizations" && request.method === "GET") {
        return await orgCtrl.getUserOrganizations(request);
      }
      if (path === "/api/organizations" && request.method === "GET") {
        return await orgCtrl.getAllOrganizations(request);
      }
      if (path.match(/^\/api\/organizations\/\d+$/) && request.method === "GET") {
        const orgId = parseInt(path.split('/').pop());
        return await orgCtrl.getOrganization(orgId);
      }
      if (path.match(/^\/api\/organizations\/\d+\/events$/)) {
        const parts = path.split('/');
        const orgId = parseInt(parts[3]);
        return await orgCtrl.getOrganizationEvents(orgId);
      }
      if (path.match(/^\/api\/organizations\/\d+$/) && request.method === "DELETE") {
        const orgId = parseInt(path.split('/').pop());
        return await orgCtrl.deleteOrganization(request, orgId);
      }

      // Event endpoints
      if (path === "/api/register-event" && request.method === "POST") {
        return await eventCtrl.registerEvent(request);
      }

      // Landmark endpoints (currently returning stub data)
      if (path === "/api/landmarks" && request.method === "GET") {
        return new Response(JSON.stringify({ success: true, landmarks: [] }), { headers: corsHeaders });
      }
      if (path === "/api/check-landmark-availability" && request.method === "POST") {
        return new Response(JSON.stringify({ success: true, available: true }), { headers: corsHeaders });
      }

      // Image serving
      if (path.startsWith("/images/")) {
        const imagePath = path.substring(8);
        return await serveImageFromR2(env, imagePath, corsHeaders);
      }

      // Expose Google Maps API key via worker endpoint
      if (path === "/api/get-maps-api-key") {
        return new Response(JSON.stringify({ success: true, apiKey: env.REACT_APP_GOOGLE_MAPS_API_KEY || '' }), { headers: corsHeaders });
      }

      // User membership endpoint
      if (path === "/api/user-member-organizations" && request.method === "GET") {
        return await orgCtrl.getUserMemberOrganizations(request);
      }

      // Official status endpoints
      if (path === "/api/verify-organization-official" && request.method === "POST") {
        const orgData = await request.json();
        const isOfficial = await officialStatusCtrl.verifyOrganizationOfficialStatus(orgData);
        return new Response(JSON.stringify({ success: true, official: isOfficial }), { headers: corsHeaders });
      }
      if (path === "/api/verify-event-official" && request.method === "POST") {
        const eventData = await request.json();
        const isOfficial = await officialStatusCtrl.verifyEventOfficialStatus(eventData);
        return new Response(JSON.stringify({ success: true, official: isOfficial }), { headers: corsHeaders });
      }

      // Admin dashboard endpoints
      if (path === "/api/pending-submissions" && request.method === "GET") {
        return await adminDashboard.displayPendingSubmissions(request);
      }
      if (path === "/api/review-submission" && request.method === "GET") {
        const itemID = parseInt(new URL(request.url).searchParams.get('itemID'));
        return await adminDashboard.reviewSubmission(itemID);
      }
      if (path === "/api/process-submission-decision" && request.method === "POST") {
        return await adminDashboard.processDecision(request);
      }

      // Default 404 Not Found
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ error: "Server error", message: error.message }),
        { status: 500, headers: corsHeaders });
    }
  }
};