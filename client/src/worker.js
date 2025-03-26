/**
 * The Quad - University Event Planner - Cloudflare Worker (Object Oriented)
 *
 * Domain classes represent the data model while controller classes encapsulate
 * the API endpoint logic.
 */
import { Utils } from './utils.js';
import { AccountController } from './accountController.js';
import { OrganizationController } from './OrganizationController.js'; // Updated import
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

/* ==================== CONTROLLER CLASSES ==================== */
class AccountController {
  constructor(env) {
    this.env = env;
  }

  async createAccount(request) {
    return BackendService.handleRequest(request, async (req) => {
      const data = await BackendService.parseRequest(req);
      const { f_name, l_name, username, email, phone, password } = data;
      if (!f_name || !l_name || !username || !email || !password) {
        throw new Error("Missing required fields");
      }

      const existingUsername = await DatabaseService.query(this.env, "SELECT * FROM USERS WHERE LOWER(username)=LOWER(?)", [username]);
      if (existingUsername.length > 0) {
        throw new Error("A user with this username already exists");
      }

      const existingUser = await DatabaseService.query(this.env, "SELECT * FROM USERS WHERE LOWER(email)=LOWER(?)", [email]);
      if (existingUser.length > 0) {
        throw new Error("A user with this email already exists");
      }

      const hashed = await hashPassword(password);
      const insertResult = await DatabaseService.execute(this.env, "INSERT INTO USERS (username, f_name, l_name, email, phone, password) VALUES (?,?,?,?,?,?)", [username, f_name, l_name, email, phone || null, hashed]);
      const userID = insertResult.meta.last_row_id;
      const token = generateJWT({ email, userId: userID, username });

      return {
        message: "User registered successfully",
        token,
        user: { id: userID, userID, username, f_name, l_name, email, phone: phone || null },
      };
    });
  }

  async login(request) {
    return BackendService.handleRequest(request, async (req) => {
      const data = await BackendService.parseRequest(req);
      const { email, password } = data;
      if (!email || !password) {
        throw new Error("Email and password are required");
      }

      const users = await DatabaseService.query(this.env, "SELECT * FROM USERS WHERE LOWER(email)=LOWER(?)", [email]);
      if (users.length === 0) {
        throw new Error("Invalid email or password");
      }

      const user = users[0];
      const passOk = await verifyPassword(password, user.password);
      if (!passOk) {
        throw new Error("Invalid email or password");
      }

      const token = generateJWT({ email: user.email, userId: user.userID, username: user.username });
      return {
        message: "Login successful",
        token,
        user: {
          id: user.userID,
          userID: user.userID,
          username: user.username,
          f_name: user.f_name,
          l_name: user.l_name,
          email: user.email,
          phone: user.phone,
          profile_picture: user.profile_picture,
        },
      };
    });
  }

  async getUserProfile(request) {
    return BackendService.handleRequest(request, async (req) => {
      const authHeader = req.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "");
      if (!token) {
        throw new Error("Authentication token required");
      }

      const payload = verifyJWT(token);
      const userId = payload.userId;
      if (!userId) throw new Error("Invalid token: missing user ID");

      const userQuery = await DatabaseService.query(this.env, "SELECT userID, f_name, l_name, email, phone, profile_picture FROM USERS WHERE userID = ?", [userId]);
      if (userQuery.length === 0) {
        throw new Error("User not found");
      }

      return { user: userQuery[0] };
    });
  }
}

class OrganizationController {
  constructor(env, corsHeaders) {
    this.env = env;
    this.corsHeaders = corsHeaders;
  }
  async registerOrganization(request) {
    try {
      const formData = await parseFormData(request);
      const name = formData.get('name');
      const description = formData.get('description') || '';
      const userID = formData.get('userID');
      const privacy = formData.get('privacy') || 'public';
      if (!name || !userID) {
        return new Response(JSON.stringify({
          success: false,
          error: "Missing required fields: name and userID"
        }), { status: 400, headers: this.corsHeaders });
      }
      const existingOrg = await this.env.D1_DB.prepare(
        "SELECT * FROM ORGANIZATION WHERE name = ?"
      ).bind(name).first();
      if (existingOrg) {
        return new Response(JSON.stringify({
          success: false,
          error: "Organization name already exists"
        }), { status: 400, headers: this.corsHeaders });
      }
      let thumbnailURL = '', bannerURL = '';
      const thumbnail = formData.get('thumbnail');
      if (thumbnail && thumbnail.size > 0) {
        const cleanName = name.replace(/\s+/g, '_');
        thumbnailURL = await Utils.uploadFileToR2(this.env, thumbnail, `thumbnails/Thumb_${cleanName}`);
      }
      const banner = formData.get('banner');
      if (banner && banner.size > 0) {
        const cleanName = name.replace(/\s+/g, '_');
        bannerURL = await Utils.uploadFileToR2(this.env, banner, `banners/Banner_${cleanName}`);
      }
      const insertResult = await this.env.D1_DB.prepare(`
        INSERT INTO ORGANIZATION (name, description, thumbnail, banner, privacy)
        VALUES (?, ?, ?, ?, ?)
      `).bind(name, description, thumbnailURL, bannerURL, privacy).run();
      const newOrgID = insertResult.meta.last_row_id;
      await this.env.D1_DB.prepare(`
        INSERT INTO ORG_ADMIN (orgID, userID)
        VALUES (?, ?)
      `).bind(newOrgID, userID).run();
      return new Response(JSON.stringify({
        success: true,
        message: "Organization created successfully",
        orgID: newOrgID
      }), { headers: this.corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: this.corsHeaders });
    }
  }
  async getUserOrganizations(request) {
    try {
      const url = new URL(request.url);
      const userID = url.searchParams.get('userID');
      if (!userID) {
        return new Response(JSON.stringify({ success: false, error: "User ID is required" }),
          { status: 400, headers: this.corsHeaders });
      }
      const { results } = await this.env.D1_DB.prepare(`
        SELECT o.* FROM ORGANIZATION o
        JOIN ORG_ADMIN oa ON o.orgID = oa.orgID
        WHERE oa.userID = ?
      `).bind(userID).all();
      return new Response(JSON.stringify({ success: true, organizations: results || [] }),
        { headers: this.corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: this.corsHeaders });
    }
  }
  async getAllOrganizations(request) {
    try {
      const { results: organizations } = await this.env.D1_DB.prepare(`
        SELECT o.*, COUNT(om.userID) as memberCount
        FROM ORGANIZATION o
        LEFT JOIN ORG_MEMBER om ON o.orgID = om.orgID
        GROUP BY o.orgID
        ORDER BY o.name ASC
      `).all();
      return new Response(JSON.stringify({ success: true, organizations: organizations || [] }),
        { headers: this.corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: this.corsHeaders });
    }
  }
  async getOrganization(orgId) {
    try {
      const organization = await this.env.D1_DB.prepare(`
        SELECT o.*, COUNT(om.userID) as memberCount
        FROM ORGANIZATION o
        LEFT JOIN ORG_MEMBER om ON o.orgID = om.orgID
        WHERE o.orgID = ?
        GROUP BY o.orgID
      `).bind(orgId).first();
      if (!organization) {
        return new Response(JSON.stringify({ success: false, error: "Organization not found" }),
          { status: 404, headers: this.corsHeaders });
      }
      const { results: admins } = await this.env.D1_DB.prepare(`
        SELECT u.userID as id, u.email, u.f_name as firstName, u.l_name as lastName, u.profile_picture as profileImage
        FROM ORG_ADMIN oa
        JOIN USERS u ON oa.userID = u.userID
        WHERE oa.orgID = ?
      `).bind(orgId).all();
      organization.admins = admins || [];
      return new Response(JSON.stringify({ success: true, organization }),
        { headers: this.corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: this.corsHeaders });
    }
  }
  async getOrganizationEvents(orgId) {
    try {
      const { results: events } = await this.env.D1_DB.prepare(`
        SELECT e.* FROM EVENT e
        WHERE e.organizationID = ?
        ORDER BY e.startDate ASC
      `).bind(orgId).all();
      return new Response(JSON.stringify({ success: true, events: events || [] }),
        { headers: this.corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: this.corsHeaders });
    }
  }
  // Stub for user member organizations (if needed)
  async getUserMemberOrganizations(request) {
    // Similar implementation to getUserOrganizations can be added here.
    return new Response(JSON.stringify({ success: true, organizations: [] }), { headers: this.corsHeaders });
  }

  async deleteOrganization(request, orgId) {
    try {
      console.log("Delete organization request received for orgId:", orgId);
      
      const authHeader = request.headers.get('Authorization') || '';
      if (!authHeader.startsWith('Bearer ')) {
        console.log("Authentication missing");
        return new Response(JSON.stringify({
          success: false,
          error: "Authentication required"
        }), { status: 401, headers: this.corsHeaders });
      }
      
      // Verify JWT token and get user ID
      const token = authHeader.replace('Bearer ', '');
      let payload;
      try {
        payload = verifyJWT(token);
        console.log("Token verified, payload:", payload);
      } catch (err) {
        console.log("Invalid token:", err);
        return new Response(JSON.stringify({
          success: false,
          error: "Invalid authentication token"
        }), { status: 401, headers: this.corsHeaders });
      }
  
      // Get the user ID from the request body
      let userData;
      try {
        userData = await request.json();
        console.log("Request body parsed:", userData);
      } catch (err) {
        console.log("Failed to parse request body:", err);
        return new Response(JSON.stringify({
          success: false,
          error: "Invalid request data"
        }), { status: 400, headers: this.corsHeaders });
      }
      
      const userID = userData.userID;
      console.log("UserID from request:", userID);
      
      if (!userID) {
        return new Response(JSON.stringify({
          success: false,
          error: "User ID is required"
        }), { status: 400, headers: this.corsHeaders });
      }
      
      // Verify the user is an admin of this organization
      console.log("Checking if user is admin for org:", orgId);
      const isAdmin = await this.env.D1_DB.prepare(`
        SELECT 1 FROM ORG_ADMIN
        WHERE orgID = ? AND userID = ?
      `).bind(orgId, userID).first();
      
      console.log("Admin check result:", isAdmin);
      
      if (!isAdmin) {
        return new Response(JSON.stringify({
          success: false,
          error: "You don't have permission to delete this organization"
        }), { status: 403, headers: this.corsHeaders });
      }
      
      // Instead of using transactions, use D1's batch API for atomicity
      console.log("Preparing batch operations for deletion");
      
      // Create an array of statements to execute as a batch
      const statements = [
        // Delete event admins for events in this org
        this.env.D1_DB.prepare(`
          DELETE FROM EVENT_ADMIN 
          WHERE eventID IN (SELECT eventID FROM EVENT WHERE organizationID = ?)
        `).bind(orgId),
        
        // Delete events
        this.env.D1_DB.prepare(
          "DELETE FROM EVENT WHERE organizationID = ?"
        ).bind(orgId),
        
        // Delete org admins
        this.env.D1_DB.prepare(
          "DELETE FROM ORG_ADMIN WHERE orgID = ?"
        ).bind(orgId),
        
        // Delete org members
        this.env.D1_DB.prepare(
          "DELETE FROM ORG_MEMBER WHERE orgID = ?"
        ).bind(orgId),
        
        // Delete the organization
        this.env.D1_DB.prepare(
          "DELETE FROM ORGANIZATION WHERE orgID = ?"
        ).bind(orgId)
      ];
      
      // Execute all statements as a batch (atomic operation)
      console.log("Executing batch delete operations");
      await this.env.D1_DB.batch(statements);
      
      console.log("Organization deletion successful");
      return new Response(JSON.stringify({
        success: true,
        message: "Organization deleted successfully"
      }), { headers: this.corsHeaders });
      
    } catch (error) {
      console.log("Deletion failed:", error.message);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), { status: 500, headers: this.corsHeaders });
    }
  }
}

class EventController {
  constructor(env, corsHeaders) {
    this.env = env;
    this.corsHeaders = corsHeaders;
  }
  async registerEvent(request) {
    try {
      const formData = await Utils.parseFormData(request);
      const organizationID = formData.get('organizationID');
      const title = formData.get('title');
      const description = formData.get('description') || '';
      const startDate = formData.get('startDate');
      const endDate = formData.get('endDate');
      const privacy = formData.get('privacy') || 'public';
      const submitForOfficialStatus = formData.get('submitForOfficialStatus') === 'true';
      const landmarkID = formData.get('landmarkID') || null;
      const customLocation = formData.get('customLocation') || '';
      const userID = formData.get('userID');
      if (!organizationID || !title || !startDate || !endDate || !userID) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Organization ID, title, start date, end date and user ID are required'
        }), { status: 400, headers: this.corsHeaders });
      }
      // Verify admin rights
      const isAdmin = await this.env.D1_DB.prepare(`
        SELECT 1 FROM ORG_ADMIN
        WHERE orgID = ? AND userID = ?
      `).bind(organizationID, userID).first();
      if (!isAdmin) {
        return new Response(JSON.stringify({
          success: false,
          error: 'User is not an admin of this organization'
        }), { status: 403, headers: this.corsHeaders });
      }
      let thumbnailURL = '', bannerURL = '';
      const thumbnail = formData.get('thumbnail');
      if (thumbnail && thumbnail.size > 0) {
        thumbnailURL = await uploadFileToR2(this.env, thumbnail, `events/thumbnails/${title}-${Date.now()}`);
      }
      const banner = formData.get('banner');
      if (banner && banner.size > 0) {
        bannerURL = await uploadFileToR2(this.env, banner, `events/banners/${title}-${Date.now()}`);
      }
      const insertResult = await this.env.D1_DB.prepare(`
        INSERT INTO EVENT (
          organizationID, title, description, thumbnail, banner,
          startDate, endDate, privacy, officialStatus, landmarkID,
          customLocation
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        organizationID, title, description, thumbnailURL, bannerURL,
        startDate, endDate, privacy, submitForOfficialStatus ? 1 : 0,
        landmarkID, customLocation
      ).run();
      const newEventID = insertResult.meta.last_row_id;
      await this.env.D1_DB.prepare(`
        INSERT INTO EVENT_ADMIN (eventID, userID)
        VALUES (?, ?)
      `).bind(newEventID, userID).run();
      return new Response(JSON.stringify({
        success: true,
        message: "Event created successfully",
        eventID: newEventID
      }), { headers: this.corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: this.corsHeaders });
    }
  }
  // Additional methods (e.g., rsvpToEvent) may be added here.
  async getAllEvents(request) {
    try {
      // Get all events with organization names included
      const { results: events } = await this.env.D1_DB.prepare(`
        SELECT e.*, o.name as organizationName
        FROM EVENT e
        JOIN ORGANIZATION o ON e.organizationID = o.orgID
        ORDER BY e.startDate ASC
      `).all();
      
      return new Response(JSON.stringify({ 
        success: true, 
        events: events || [] 
      }), { headers: this.corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), { status: 500, headers: this.corsHeaders });
    }
  }
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
        return await accountCtrl.createAccount(request);
      }
      if (path === "/api/login" && request.method === "POST") {
        return await accountCtrl.login(request);
      }
      if (path === "/api/user-profile" && request.method === "GET") {
        return await accountCtrl.getUserProfile(request);
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
        const orgId = parseInt(path.split("/").pop());
        return await orgCtrl.getOrganization(orgId);
      }
      if (path.match(/^\/api\/organizations\/\d+\/events$/)) {
        const parts = path.split("/");
        const orgId = parseInt(parts[3]);
        return await orgCtrl.getOrganizationEvents(orgId);
      }
      if (path.match(/^\/api\/organizations\/\d+$/) && request.method === "DELETE") {
        const orgId = parseInt(path.split("/").pop());
        return await orgCtrl.deleteOrganization(request, orgId);
      }

      // Event endpoints
      if (path === "/api/register-event" && request.method === "POST") {
        return await eventCtrl.registerEvent(request);
      }
      if (path === "/api/events" && request.method === "GET") {
        return await eventCtrl.getAllEvents(request);
      }

      // Default 404 Not Found
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    } catch (error) {
      return new Response(JSON.stringify({ error: "Server error", message: error.message }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
  },
};

/* ==================== UTILITY FUNCTIONS: Database Schema Management ==================== */
class DatabaseService {
  static async query(env, sql, params = []) {
    try {
      const statement = env.D1_DB.prepare(sql);
      params.forEach((param, index) => {
        statement.bind(param, index + 1);
      });
      const { results } = await statement.all();
      return results;
    } catch (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }
  }

  static async execute(env, sql, params = []) {
    try {
      const statement = env.D1_DB.prepare(sql);
      params.forEach((param, index) => {
        statement.bind(param, index + 1);
      });
      const result = await statement.run();
      return result;
    } catch (error) {
      throw new Error(`Database execution failed: ${error.message}`);
    }
  }
}

class BackendService {
  static async handleRequest(request, handler) {
    try {
      const response = await handler(request);
      return new Response(JSON.stringify({ success: true, ...response }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  }

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
