/**
 * The Quad - University Event Planner - Cloudflare Worker (Object Oriented)
 *
 * Domain classes represent the data model while controller classes encapsulate
 * the API endpoint logic.
 */

/* ==================== UTILITY FUNCTIONS ==================== */
async function parseFormData(request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data') ||
      contentType.includes('application/x-www-form-urlencoded')) {
    return await request.formData();
  } else if (contentType.includes('application/json')) {
    const json = await request.json();
    const formData = new FormData();
    Object.entries(json).forEach(([key, value]) => {
      formData.append(key, value);
    });
    return formData;
  }
  return new FormData();
}

function generateJWT(payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = { ...payload, iat: now, exp: now + (60 * 60 * 24) };
  const base64Header = btoa(JSON.stringify(header));
  const base64Payload = btoa(JSON.stringify(jwtPayload));
  // Placeholder signature (in production, sign with a secret)
  const signature = btoa("thequadsignature");
  return `${base64Header}.${base64Payload}.${signature}`;
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "the-quad-salt");
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyPassword(password, hashedPassword) {
  const passwordHash = await hashPassword(password);
  return passwordHash === hashedPassword;
}

function verifyJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token format');
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000))
      throw new Error('Token has expired');
    return payload;
  } catch (error) {
    throw new Error(`Invalid token: ${error.message}`);
  }
}

async function uploadFileToR2(env, file, path) {
  if (!env.R2_BUCKET) {
    throw new Error("Missing R2_BUCKET binding");
  }
  const buffer = await file.arrayBuffer();
  const contentType = file.type || 'application/octet-stream';
  await env.R2_BUCKET.put(path, buffer, { httpMetadata: { contentType } });
  return `/images/${path}`;
}

async function serveImageFromR2(env, imagePath, corsHeaders) {
  let object = await env.R2_BUCKET.get(imagePath);
  if (object === null && imagePath.includes('/')) {
    const parts = imagePath.split('/');
    object = await env.R2_BUCKET.get(parts.pop());
  }
  if (object === null) {
    return new Response("Image not found", { status: 404, headers: corsHeaders });
  }
  const extension = imagePath.split('.').pop().toLowerCase();
  const contentTypes = {
    'jpg':'image/jpeg','jpeg':'image/jpeg','png':'image/png',
    'gif':'image/gif','svg':'image/svg+xml','webp':'image/webp',
    'bmp':'image/bmp','ico':'image/x-icon'
  };
  const contentType = contentTypes[extension] || 'application/octet-stream';
  return new Response(object.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

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
    // For now, always return true
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
  constructor(env, corsHeaders) {
    this.env = env;
    this.corsHeaders = corsHeaders;
  }
  async createAccount(request) {
    try {
      const data = await request.json();
      const { f_name, l_name, username, email, phone, password } = data;
      if (!f_name || !l_name || !username || !email || !password) {
        const missing = [];
        if (!f_name) missing.push('First Name');
        if (!l_name) missing.push('Last Name');
        if (!username) missing.push('Username');
        if (!email) missing.push('Email');
        if (!password) missing.push('Password');
        return new Response(JSON.stringify({
          success: false,
          error: `Missing required fields: ${missing.join(', ')}`
        }), { status: 400, headers: this.corsHeaders });
      }
      
      // Check if username already exists
      const existingUsername = await this.env.D1_DB.prepare(
        "SELECT * FROM USERS WHERE LOWER(username)=LOWER(?)"
      ).bind(username).first();
      if (existingUsername) {
        return new Response(JSON.stringify({
          success: false,
          error: "A user with this username already exists"
        }), { status: 400, headers: this.corsHeaders });
      }
      
      // Check if email already exists
      const existingUser = await this.env.D1_DB.prepare(
        "SELECT * FROM USERS WHERE LOWER(email)=LOWER(?)"
      ).bind(email).first();
      if (existingUser) {
        return new Response(JSON.stringify({
          success: false,
          error: "A user with this email already exists"
        }), { status: 400, headers: this.corsHeaders });
      }
      
      const hashed = await hashPassword(password);
      const insertResult = await this.env.D1_DB.prepare(
        "INSERT INTO USERS (username, f_name, l_name, email, phone, password) VALUES (?,?,?,?,?,?)"
      ).bind(username, f_name, l_name, email, phone || null, hashed).run();
      const userID = insertResult.meta.last_row_id;
      const token = generateJWT({ email, userId: userID, username });
      return new Response(JSON.stringify({
        success: true,
        message: "User registered successfully",
        token,
        user: { id: userID, userID, username, f_name, l_name, email, phone: phone || null }
      }), { headers: this.corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: this.corsHeaders });
    }
  }
  async login(request) {
    try {
      const data = await request.json();
      const { email, password } = data;
      if (!email || !password) {
        return new Response(JSON.stringify({
          success: false,
          error: "Email and password are required"
        }), { status: 400, headers: this.corsHeaders });
      }
      const usersQuery = await this.env.D1_DB.prepare(
        "SELECT * FROM USERS WHERE LOWER(email)=LOWER(?)"
      ).bind(email).all();
      const users = usersQuery.results;
      if (!users || users.length === 0) {
        return new Response(JSON.stringify({ success: false, error: "Invalid email or password" }),
          { status: 401, headers: this.corsHeaders });
      }
      const user = users[0];
      const passOk = await verifyPassword(password, user.password);
      if (!passOk) {
        return new Response(JSON.stringify({ success: false, error: "Invalid email or password" }),
          { status: 401, headers: this.corsHeaders });
      }
      const token = generateJWT({ email: user.email, userId: user.userID, username: user.username });
      return new Response(JSON.stringify({
        success: true,
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
          profile_picture: user.profile_picture
        }
      }), { headers: this.corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: this.corsHeaders });
    }
  }
  async getUserProfile(request) {
    try {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '');
      if (!token) {
        return new Response(JSON.stringify({ success: false, error: "Authentication token required" }),
          { status: 401, headers: this.corsHeaders });
      }
      const payload = verifyJWT(token);
      const userId = payload.userId;
      if (!userId) throw new Error("Invalid token: missing user ID");
      const userQuery = await this.env.D1_DB.prepare(
        "SELECT userID, f_name, l_name, email, phone, profile_picture FROM USERS WHERE userID = ?"
      ).bind(userId).first();
      if (!userQuery) {
        return new Response(JSON.stringify({ success: false, error: "User not found" }),
          { status: 404, headers: this.corsHeaders });
      }
      return new Response(JSON.stringify({ success: true, user: userQuery }),
        { headers: this.corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: this.corsHeaders });
    }
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
        thumbnailURL = await uploadFileToR2(this.env, thumbnail, `thumbnails/Thumb_${cleanName}`);
      }
      const banner = formData.get('banner');
      if (banner && banner.size > 0) {
        const cleanName = name.replace(/\s+/g, '_');
        bannerURL = await uploadFileToR2(this.env, banner, `banners/Banner_${cleanName}`);
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
}

class EventController {
  constructor(env, corsHeaders) {
    this.env = env;
    this.corsHeaders = corsHeaders;
  }
  async registerEvent(request) {
    try {
      const formData = await parseFormData(request);
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
    const officialStatusCtrl = new OfficialStatusController();
    const adminDashboard = new AdminDashboard();

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
      if (path.match(/^\/api\/organizations\/\d+$/)) {
        const orgId = parseInt(path.split('/').pop());
        return await orgCtrl.getOrganization(orgId);
      }
      if (path.match(/^\/api\/organizations\/\d+\/events$/)) {
        const parts = path.split('/');
        const orgId = parseInt(parts[3]);
        return await orgCtrl.getOrganizationEvents(orgId);
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

      // Database management endpoints
      if (path === "/api/fix-database-schema")
        return await fixDatabaseSchema(env, corsHeaders);
      if (path === "/api/diagnostics/schema")
        return await getDatabaseSchema(env, corsHeaders);
      if (path === "/api/add-username-column") {
        return await addUsernameColumn(env, corsHeaders);
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

      // (Optional) Official status endpoints could be added here:
      if (path === "/api/verify-organization-official" && request.method === "POST") {
        // Example: verify and return official status for an organization
        const orgData = await request.json();
        const isOfficial = officialStatusCtrl.verifyOrganizationOfficialStatus(orgData);
        return new Response(JSON.stringify({ success: true, official: isOfficial }), { headers: corsHeaders });
      }
      if (path === "/api/verify-event-official" && request.method === "POST") {
        const eventData = await request.json();
        const isOfficial = officialStatusCtrl.verifyEventOfficialStatus(eventData);
        return new Response(JSON.stringify({ success: true, official: isOfficial }), { headers: corsHeaders });
      }

      // Admin dashboard stub endpoints:
      if (path === "/api/pending-submissions" && request.method === "GET") {
        const submissions = adminDashboard.displayPendingSubmissions();
        return new Response(JSON.stringify({ success: true, submissions }), { headers: corsHeaders });
      }
      if (path === "/api/review-submission" && request.method === "GET") {
        const itemID = parseInt(new URL(request.url).searchParams.get('itemID'));
        const item = adminDashboard.reviewSubmission(itemID);
        return new Response(JSON.stringify({ success: true, item }), { headers: corsHeaders });
      }

      // Default 404 Not Found
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ error: "Server error", message: error.message }),
        { status: 500, headers: corsHeaders });
    }
  }
};

/* ==================== UTILITY FUNCTIONS: Database Schema Management ==================== */
// place utility functions here