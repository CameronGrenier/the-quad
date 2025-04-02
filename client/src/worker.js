/**
 * The Quad - University Event Planner - Cloudflare Worker (Object Oriented)
 *
 * Domain classes represent the data model while controller classes encapsulate
 * the API endpoint logic.
 */

import BackendService from './services/BackendService.js';

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

/* ==================== CONTROLLER CLASSES ==================== */
class AccountController {
  constructor(env, corsHeaders, backendService) {
    this.env = env;
    this.corsHeaders = corsHeaders;
    this.backendService = backendService;
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
      const existingUsername = await this.backendService.queryFirst(
        "SELECT * FROM USERS WHERE LOWER(username)=LOWER(?)", 
        [username]
      );
      if (existingUsername) {
        return new Response(JSON.stringify({
          success: false,
          error: "A user with this username already exists"
        }), { status: 400, headers: this.corsHeaders });
      }
      
      // Check if email already exists
      const existingUser = await this.backendService.queryFirst(
        "SELECT * FROM USERS WHERE LOWER(email)=LOWER(?)", 
        [email]
      );
      if (existingUser) {
        return new Response(JSON.stringify({
          success: false,
          error: "A user with this email already exists"
        }), { status: 400, headers: this.corsHeaders });
      }
      
      const hashed = await hashPassword(password);
      const insertResult = await this.backendService.query(
        "INSERT INTO USERS (username, f_name, l_name, email, phone, password) VALUES (?,?,?,?,?,?)",
        [username, f_name, l_name, email, phone || null, hashed]
      );
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
      
      const usersQuery = await this.backendService.queryAll(
        "SELECT * FROM USERS WHERE LOWER(email)=LOWER(?)",
        [email]
      );
      
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
      
      const userQuery = await this.backendService.queryFirst(
        "SELECT userID, f_name, l_name, email, phone, profile_picture FROM USERS WHERE userID = ?",
        [userId]
      );
      
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

  async updateProfile(request) {
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
      
      const formData = await parseFormData(request);
      const f_name = formData.get('f_name');
      const l_name = formData.get('l_name');
      const email = formData.get('email');
      const phone = formData.get('phone') || null;
      
      if (!f_name || !l_name || !email) {
        return new Response(JSON.stringify({
          success: false,
          error: "First name, last name and email are required"
        }), { status: 400, headers: this.corsHeaders });
      }
      
      // Check if email is taken by another user
      const existingUser = await this.backendService.queryFirst(
        "SELECT * FROM USERS WHERE LOWER(email)=LOWER(?) AND userID != ?",
        [email, userId]
      );
      
      if (existingUser) {
        return new Response(JSON.stringify({
          success: false,
          error: "This email address is already in use by another account"
        }), { status: 400, headers: this.corsHeaders });
      }
      
      // Handle profile picture upload if provided
      let profilePictureUrl = null;
      const profilePicture = formData.get('profile_picture');
      
      if (profilePicture && profilePicture.size > 0) {
        // Generate a unique filename for the profile picture
        profilePictureUrl = await this.backendService.uploadFile(
          profilePicture, 
          `profile_pictures/user_${userId}_${Date.now()}`
        );
      }
      
      // Update user information in database
      let updateQuery = `
        UPDATE USERS 
        SET f_name = ?, l_name = ?, email = ?, phone = ?
      `;
      
      let params = [f_name, l_name, email, phone];
      
      // Only update profile picture if a new one was uploaded
      if (profilePicture && profilePicture.size > 0) {
        updateQuery += `, profile_picture = ?`;
        params.push(profilePictureUrl);
      }
      
      updateQuery += ` WHERE userID = ?`;
      params.push(userId);
      
      await this.backendService.query(updateQuery, params);
      
      // Fetch updated user data to return
      const updatedUser = await this.backendService.queryFirst(
        "SELECT userID, f_name, l_name, email, phone, profile_picture FROM USERS WHERE userID = ?",
        [userId]
      );
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Profile updated successfully",
        user: updatedUser
      }), { headers: this.corsHeaders });
    } catch (error) {
      console.error("Error in updateProfile:", error);
      return new Response(JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: this.corsHeaders });
    }
  }
}

class OrganizationController {
  constructor(env, corsHeaders, backendService) {
    this.env = env;
    this.corsHeaders = corsHeaders;
    this.backendService = backendService;
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
      
      const existingOrg = await this.backendService.queryFirst(
        "SELECT * FROM ORGANIZATION WHERE name = ?",
        [name]
      );
      
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
        thumbnailURL = await this.backendService.uploadFile(thumbnail, `thumbnails/Thumb_${cleanName}`);
      }
      
      const banner = formData.get('banner');
      if (banner && banner.size > 0) {
        const cleanName = name.replace(/\s+/g, '_');
        bannerURL = await this.backendService.uploadFile(banner, `banners/Banner_${cleanName}`);
      }
      
      const insertResult = await this.backendService.query(
        `INSERT INTO ORGANIZATION (name, description, thumbnail, banner, privacy)
         VALUES (?, ?, ?, ?, ?)`,
        [name, description, thumbnailURL, bannerURL, privacy]
      );
      
      const newOrgID = insertResult.meta.last_row_id;
      await this.backendService.query(
        `INSERT INTO ORG_ADMIN (orgID, userID) VALUES (?, ?)`,
        [newOrgID, userID]
      );
      
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
      
      const organizations = await this.backendService.queryAll(
        `SELECT o.* FROM ORGANIZATION o
         JOIN ORG_ADMIN oa ON o.orgID = oa.orgID
         WHERE oa.userID = ?`,
        [userID]
      );
      
      return new Response(JSON.stringify({ 
        success: true, 
        organizations: organizations.results || [] 
      }), { headers: this.corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: this.corsHeaders });
    }
  }
  
  async getAllOrganizations(request) {
    try {
      const organizations = await this.backendService.queryAll(
        `SELECT o.*, COUNT(om.userID) as memberCount
         FROM ORGANIZATION o
         LEFT JOIN ORG_MEMBER om ON o.orgID = om.orgID
         GROUP BY o.orgID
         ORDER BY o.name ASC`
      );
      
      return new Response(JSON.stringify({ 
        success: true, 
        organizations: organizations.results || [] 
      }), { headers: this.corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: this.corsHeaders });
    }
  }
  
  async getOrganization(orgId) {
    try {
      const organization = await this.backendService.queryFirst(
        `SELECT o.*, COUNT(om.userID) as memberCount
         FROM ORGANIZATION o
         LEFT JOIN ORG_MEMBER om ON o.orgID = om.orgID
         WHERE o.orgID = ?
         GROUP BY o.orgID`,
        [orgId]
      );
      
      if (!organization) {
        return new Response(JSON.stringify({ success: false, error: "Organization not found" }),
          { status: 404, headers: this.corsHeaders });
      }
      
      const admins = await this.backendService.queryAll(
        `SELECT u.userID as id, u.email, u.f_name as firstName, u.l_name as lastName, 
         u.profile_picture as profileImage
         FROM ORG_ADMIN oa
         JOIN USERS u ON oa.userID = u.userID
         WHERE oa.orgID = ?`,
        [orgId]
      );
      
      organization.admins = admins.results || [];
      
      return new Response(JSON.stringify({ success: true, organization }),
        { headers: this.corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: this.corsHeaders });
    }
  }
  
  async getOrganizationEvents(orgId) {
    try {
      const events = await this.backendService.queryAll(
        `SELECT e.* FROM EVENT e
         WHERE e.organizationID = ?
         ORDER BY e.startDate ASC`,
        [orgId]
      );
      
      return new Response(JSON.stringify({ 
        success: true, 
        events: events.results || [] 
      }), { headers: this.corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: this.corsHeaders });
    }
  }
}

class EventController {
  constructor(env, corsHeaders, backendService) {
    this.env = env;
    this.corsHeaders = corsHeaders;
    this.backendService = backendService;
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
      const isAdmin = await this.backendService.queryFirst(
        `SELECT 1 FROM ORG_ADMIN
         WHERE orgID = ? AND userID = ?`,
        [organizationID, userID]
      );
      
      if (!isAdmin) {
        return new Response(JSON.stringify({
          success: false,
          error: 'User is not an admin of this organization'
        }), { status: 403, headers: this.corsHeaders });
      }
      
      let thumbnailURL = '', bannerURL = '';
      const thumbnail = formData.get('thumbnail');
      if (thumbnail && thumbnail.size > 0) {
        // Replace spaces with underscores in the file path
        const sanitizedTitle = title.replace(/\s+/g, '_');
        thumbnailURL = await this.backendService.uploadFile(
          thumbnail, 
          `events/thumbnails/${sanitizedTitle}-${Date.now()}`
        );
      }
      
      const banner = formData.get('banner');
      if (banner && banner.size > 0) {
        // Replace spaces with underscores in the file path
        const sanitizedTitle = title.replace(/\s+/g, '_');
        bannerURL = await this.backendService.uploadFile(
          banner, 
          `events/banners/${sanitizedTitle}-${Date.now()}`
        );
      }
      
      const insertResult = await this.backendService.query(
        `INSERT INTO EVENT (
          organizationID, title, description, thumbnail, banner,
          startDate, endDate, privacy, officialStatus, landmarkID,
          customLocation
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          organizationID, title, description, thumbnailURL, bannerURL,
          startDate, endDate, privacy, submitForOfficialStatus ? 1 : 0,
          landmarkID, customLocation
        ]
      );
      
      const newEventID = insertResult.meta.last_row_id;
      await this.backendService.query(
        `INSERT INTO EVENT_ADMIN (eventID, userID) VALUES (?, ?)`,
        [newEventID, userID]
      );
      
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
}

export default {
  async fetch(request, env, ctx) {
    const backendService = new BackendService(env);
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

    const accountCtrl = new AccountController(env, corsHeaders, backendService);
    const orgCtrl = new OrganizationController(env, corsHeaders, backendService);
    const eventCtrl = new EventController(env, corsHeaders, backendService);

    try {
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
      if (path.match(/^\/api\/organizations\/\d+\/events$/)) {
        const parts = path.split('/');
        const orgId = parseInt(parts[3]);
        return await orgCtrl.getOrganizationEvents(orgId);
      }
      if (path === "/api/register-event" && request.method === "POST") {
        return await eventCtrl.registerEvent(request);
      }
      if (path.startsWith("/images/")) {
        const imagePath = path.substring(8);
        return await backendService.serveImage(imagePath, corsHeaders);
      }
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ error: "Server error", message: error.message }),
        { status: 500, headers: corsHeaders });
    }
  }
};