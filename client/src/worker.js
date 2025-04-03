/**
 * The Quad - University Event Planner - Cloudflare Worker (Object Oriented)
 *
 * Domain classes represent the data model while controller classes encapsulate
 * the API endpoint logic.
 */

import BackendService from './services/BackendService.js';
import Auth from './utils/auth.js';
import formDataUtil from './utils/formData.js';
import AccountController from './controllers/AccountController.js';
import OrganizationController from './controllers/OrganizationController.js';
import EventController from './controllers/EventController.js';
import AdminController from './controllers/AdminController.js';

/* ==================== MAIN WORKER FUNCTION ==================== */
export default {
  async fetch(request, env, ctx) {
    const backendService = new BackendService(env);
    const auth = new Auth();
    
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

    const accountCtrl = new AccountController(env, corsHeaders, backendService, auth);
    const orgCtrl = new OrganizationController(env, corsHeaders, backendService, auth);
    const eventCtrl = new EventController(env, corsHeaders, backendService, auth);
    const adminCtrl = new AdminController(env, corsHeaders, backendService, auth);

    try {
      // Routes remain the same - no changes needed here
      if (path === "/api/signup" && request.method === "POST") {
        return await accountCtrl.createAccount(request);
      }
      if (path === "/api/login" && request.method === "POST") {
        return await accountCtrl.login(request);
      }
      if (path === "/api/user-profile" && request.method === "GET") {
        return await accountCtrl.getUserProfile(request);
      }
      if (path === "/api/update-profile" && request.method === "POST") {
        return await accountCtrl.updateProfile(request);
      }
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
      if (path.match(/^\/api\/organizations\/\d+$/) && request.method === "PUT") {
        const orgId = parseInt(path.split('/').pop());
        return await orgCtrl.updateOrganization(orgId, request);
      }

      if (path.match(/^\/api\/organizations\/\d+$/) && request.method === "DELETE") {
        const orgId = parseInt(path.split('/').pop());
        return await orgCtrl.deleteOrganization(orgId, request);
      }

      if (path.match(/^\/api\/organizations\/\d+\/events$/)) {
        const parts = path.split('/');
        const orgId = parseInt(parts[3]);
        return await orgCtrl.getOrganizationEvents(orgId);
      }
      if (path.match(/^\/api\/organizations\/\d+\/members$/) && request.method === "GET") {
        const orgId = parseInt(path.split('/').pop());
        return await orgCtrl.getOrganizationMembers(orgId, request);
      }
      if (path.match(/^\/api\/organizations\/\d+\/members\/\d+$/) && request.method === "DELETE") {
        const parts = path.split('/');
        const orgId = parseInt(parts[3]);
        const memberId = parseInt(parts[5]);
        return await orgCtrl.removeMember(orgId, memberId, request);
      }
      if (path.match(/^\/api\/organizations\/\d+\/admins$/) && request.method === "POST") {
        const orgId = parseInt(path.split('/').pop());
        return await orgCtrl.addAdmin(orgId, request);
      }
      if (path.match(/^\/api\/organizations\/\d+\/admins\/\d+$/) && request.method === "DELETE") {
        const parts = path.split('/');
        const orgId = parseInt(parts[3]);
        const adminId = parseInt(parts[5]);
        return await orgCtrl.removeAdmin(orgId, adminId, request);
      }
      if (path === "/api/user-member-organizations" && request.method === "GET") {
        return await orgCtrl.getUserMemberOrganizations(request);
      }
      
      // Add these new routes for events
      if (path === "/api/events" && request.method === "GET") {
        return await eventCtrl.getAllEvents(request);
      }
      
      if (path.match(/^\/api\/events\/\d+$/) && request.method === "GET") {
        const eventId = parseInt(path.split('/').pop());
        return await eventCtrl.getEventById(eventId);
      }
      
      // RSVP route
      if (path.match(/^\/api\/events\/\d+\/rsvp$/) && request.method === "POST") {
        const eventId = parseInt(path.split('/')[3]);
        return await eventCtrl.handleEventRSVP(eventId, request);
      }
      
      // RSVP status route
      if (path.match(/^\/api\/events\/\d+\/rsvp-status$/) && request.method === "GET") {
        const eventId = parseInt(path.split('/')[3]);
        return await eventCtrl.getRSVPStatus(eventId, request);
      }
      
      if (path === "/api/register-event" && request.method === "POST") {
        return await eventCtrl.registerEvent(request);
      }
      
      // Add this new route for user events
      if (path === "/api/user/events" && request.method === "GET") {
        return await eventCtrl.getUserEvents(request);
      }
      
      if (path === "/api/check-membership" && request.method === "GET") {
        return await orgCtrl.checkMembership(request);
      }

      if (path === "/api/organization-membership" && request.method === "POST") {
        return await orgCtrl.handleMembership(request);
      }
      
      if (path.startsWith("/images/")) {
        const imagePath = path.substring(8);
        return await backendService.serveImage(imagePath, corsHeaders);
      }

      // Add these routes to handle admin requests for pending items

      // Test if a user is staff
      if (path === "/api/admin/test-staff" && request.method === "GET") {
        return await adminCtrl.testStaff(request);
      }

      // Get pending official status requests
      if (path === "/api/admin/pending-requests" && request.method === "GET") {
        return await adminCtrl.getPendingRequests(request);
      }

      // Get counts of pending items
      if (path === "/api/admin/pending-counts" && request.method === "GET") {
        return await adminCtrl.getPendingCounts(request);
      }

      // Get organization details for admin
      if (path.match(/\/api\/admin\/org-details\/(\d+)/) && request.method === "GET") {
        const orgId = path.match(/\/api\/admin\/org-details\/(\d+)/)[1];
        return await adminCtrl.getOrganizationDetails(request, orgId);
      }

      // Get event details for admin
      if (path.match(/\/api\/admin\/event-details\/(\d+)/) && request.method === "GET") {
        const eventId = path.match(/\/api\/admin\/event-details\/(\d+)/)[1];
        return await adminCtrl.getEventDetails(request, eventId);
      }

      // Approve an official status request
      if (path === "/api/admin/approve-official" && request.method === "POST") {
        return await adminCtrl.approveOfficial(request);
      }

      // Reject an official status request
      if (path === "/api/admin/reject-official" && request.method === "POST") {
        return await adminCtrl.rejectOfficial(request);
      }

      // Check if item is in OFFICIAL_PENDING
      if (path === "/api/admin/check-official-pending" && request.method === "GET") {
        return await adminCtrl.checkOfficialPending(request);
      }

      // Check if item is in OFFICIAL
      if (path === "/api/admin/check-official" && request.method === "GET") {
        return await adminCtrl.checkOfficial(request);
      }

      // Submit for official status
      if (path === "/api/submit-for-official" && request.method === "POST") {
        return await adminCtrl.submitForOfficial(request);
      }
      
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ error: "Server error", message: error.message }),
        { status: 500, headers: corsHeaders });
    }
  }
};