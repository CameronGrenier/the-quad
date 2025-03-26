/**
 * The Quad - University Event Planner - Cloudflare Worker (Object Oriented)
 *
 * Domain classes represent the data model while controller classes encapsulate
 * the API endpoint logic.
 */
import { Utils, BackendService } from './utils.js';
import { AccountController } from './accountController.js';
import { OrganizationController } from './OrganizationController.js';
import { EventController } from './eventController.js';

/* ==================== DOMAIN CLASSES ==================== */
class User {
  constructor({ userID, username, fName, lName, email, phone, profilePicture }) {
    this.userID = userID;
    this.username = username;
    this.fName = fName;
    this.lName = lName;
    this.email = email;
    this.phone = phone;
    this.profilePicture = profilePicture;
  }
  async createAccount() { /* see AccountController.createAccount */ }
  async modifyAccountSettings() { /* implement as needed */ }
}

class Organization {
  constructor({ orgID, name, description, thumbnail, banner, privacy }) {
    this.orgID = orgID;
    this.name = name;
    this.description = description;
    this.thumbnail = thumbnail;
    this.banner = banner;
    this.privacy = privacy;
  }
  async createOrganization() { /* see OrganizationController.registerOrganization */ }
  async modifyOrganization() { /* implement as needed */ }
  async joinOrganization() { /* implement membership joining logic */ }
}

class Event {
  constructor({ eventID, organizationID, title, description, thumbnail, banner,
    startDate, endDate, privacy, officialStatus, landmarkID }) {
    this.eventID = eventID;
    this.organizationID = organizationID;
    this.title = title;
    this.description = description;
    this.thumbnail = thumbnail;
    this.banner = banner;
    this.startDate = startDate;
    this.endDate = endDate;
    this.privacy = privacy;
    this.officialStatus = officialStatus;
    this.landmarkID = landmarkID;
  }
  async createEvent() { /* see EventController.registerEvent */ }
  async rsvpToEvent(status) { /* implement as needed */ }
}

class Landmark {
  constructor({ landmarkID, name, location, multiEventAllowed }) {
    this.landmarkID = landmarkID;
    this.name = name;
    this.location = location;
    this.multiEventAllowed = multiEventAllowed;
  }
  async checkAvailability(dateRange) {
    //Check to see if a location is available at a given date range
    //Case: Multi Event Allowed 
    return true;
  }
}

// Additional Domain Classes per diagram (stubs)
class PendingSubmission {
  constructor({ orgID = null, eventID = null }) {
    this.orgID = orgID;
    this.eventID = eventID;
  }
}
class OfficialOrgs {
  constructor({ orgID }) { this.orgID = orgID; }
}
class OfficialEvents {
  constructor({ eventID }) { this.eventID = eventID; }
}

// Stub implementations for official status and admin dashboard controllers:
class OfficialStatusController {
  verifyOrganizationOfficialStatus(org) { 
    // Implementation to verify official status for an organization
    return true;
  }
  verifyEventOfficialStatus(event) { 
    // Implementation to verify official status for an event 
    return true;
  }
  acceptOrganization(org) { 
    // Process acceptance (stub)
  }
  acceptEvent(event) { 
    // Process acceptance (stub)
  }
  denySubmission(item) { 
    // Process denial (stub)
  }
}

class AdminDashboard {
  displayPendingSubmissions() { return []; }
  reviewSubmission(itemID) { return {}; }
  processDecision(item, decision) { }
}

/* ==================== MAIN WORKER FUNCTION ==================== */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Instantiate controllers with environment
    const accountCtrl = new AccountController(env);
    const orgCtrl = new OrganizationController(env);
    const eventCtrl = new EventController(env);

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
  },
};
