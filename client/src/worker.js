/**
 * The Quad - University Event Planner - Cloudflare Worker (Object Oriented)
 *
 * Domain classes represent the data model while controller classes encapsulate
 * the API endpoint logic.
 */
import { BackendService } from './utils.js';
import { AccountController } from './accountController.js';
import { OrganizationController } from './OrganizationController.js';
import { EventController } from './eventController.js';
import { OfficialStatusController } from './OfficialStatusController.js';
import { AdminDashboard } from './AdminDashboard.js';

/* ==================== MAIN WORKER FUNCTION ==================== */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Instantiate controllers with environment
    const accountCtrl = new AccountController(env);
    const orgCtrl = new OrganizationController(env);
    const eventCtrl = new EventController(env);
    const officialStatusCtrl = new OfficialStatusController();
    const adminDashboard = new AdminDashboard();

    try {
      // Authentication endpoints
      if (path === "/api/signup" && request.method === "POST") {
        return BackendService.handleRequest(request, (req) => accountCtrl.createAccount(req));
      }
      if (path === "/api/login" && request.method === "POST") {
        return BackendService.handleRequest(request, (req) => accountCtrl.login(req));
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
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    } catch (error) {
      return new Response(JSON.stringify({ error: "Server error", message: error.message }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
  }
}