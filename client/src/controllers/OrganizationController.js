/**
 * Organization Controller for The Quad
 * 
 * Handles organization operations like creation, retrieval, and management
 */

import formDataUtil from '../utils/formData.js';

class OrganizationController {
  constructor(env, corsHeaders, backendService, auth) {
    this.env = env;
    this.corsHeaders = corsHeaders;
    this.backendService = backendService;
    this.auth = auth;
  }
  
  async registerOrganization(request) {
    try {
      const formData = await formDataUtil.parseFormData(request);
      const name = formData.get('name');
      const description = formData.get('description') || '';
      const userID = formData.get('userID');
      const privacy = formData.get('privacy') || 'public';
      const submitForOfficialStatus = formData.get('submitForOfficialStatus') === 'true';
      
      if (!name || !userID) {
        return new Response(JSON.stringify({
          success: false,
          error: "Missing required fields: name and userID"
        }), { status: 400, headers: this.corsHeaders });
      }
      
      // Check if thumbnails and banners are provided when submitting for official status
      if (submitForOfficialStatus) {
        const thumbnail = formData.get('thumbnail');
        const banner = formData.get('banner');
        
        if (!thumbnail || thumbnail.size === 0) {
          return new Response(JSON.stringify({
            success: false,
            error: "Thumbnail is required when submitting for official status"
          }), { status: 400, headers: this.corsHeaders });
        }
        
        if (!banner || banner.size === 0) {
          return new Response(JSON.stringify({
            success: false,
            error: "Banner is required when submitting for official status"
          }), { status: 400, headers: this.corsHeaders });
        }
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
      
      // Add to OFFICIAL_PENDING if requested
      if (submitForOfficialStatus) {
        await this.backendService.query(
          `INSERT INTO OFFICIAL_PENDING (orgID, eventID) VALUES (?, NULL)`,
          [newOrgID]
        );
// console.log(`Added organization ${newOrgID} to OFFICIAL_PENDING table`);
      }
      
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

  /**
   * Get organizations where the user is a member (but not an admin)
   * @param {Request} request - The request object
   * @returns {Response} JSON response with organizations
   */
  async getUserMemberOrganizations(request) {
    try {
      const url = new URL(request.url);
      const userId = url.searchParams.get('userID');
      
      if (!userId) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "User ID is required" 
          }), 
          { status: 400, headers: this.corsHeaders }
        );
      }
      
      // First, get organizations where user is an admin
      const adminOrgsQuery = `
        SELECT o.orgID 
        FROM ORGANIZATION o
        JOIN ORG_ADMIN oa ON o.orgID = oa.orgID
        WHERE oa.userID = ?
      `;
      
      const adminOrgsResult = await this.backendService.queryAll(adminOrgsQuery, [userId]);
      const adminOrgIds = (adminOrgsResult.results || []).map(org => org.orgID);
      
      // Then, get organizations where user is a member but not an admin
      let memberOrgsQuery = `
        SELECT o.*, COUNT(DISTINCT om2.userID) as memberCount
        FROM ORGANIZATION o
        JOIN ORG_MEMBER om ON o.orgID = om.orgID AND om.userID = ?
        LEFT JOIN ORG_MEMBER om2 ON o.orgID = om2.orgID
      `;
      
      // If user is admin of any orgs, exclude those
      if (adminOrgIds.length > 0) {
        memberOrgsQuery += ` WHERE o.orgID NOT IN (${adminOrgIds.join(',')})`;
      }
      
      memberOrgsQuery += ' GROUP BY o.orgID';
      
      const orgsResult = await this.backendService.queryAll(memberOrgsQuery, [userId]);
      
      return new Response(
        JSON.stringify({
          success: true,
          organizations: orgsResult.results || []
        }),
        { headers: this.corsHeaders }
      );
    } catch (error) {
      console.error("Error in getUserMemberOrganizations:", error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message 
        }), 
        { status: 500, headers: this.corsHeaders }
      );
    }
  }

  /**
   * Check if a user is a member of an organization
   * @param {Request} request - The request object
   * @returns {Response} JSON response with membership status
   */
  async checkMembership(request) {
    try {
      const url = new URL(request.url);
      const orgId = url.searchParams.get('orgID');
      const userId = url.searchParams.get('userID');
      
      if (!orgId || !userId) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Both organization ID and user ID are required" 
          }), 
          { status: 400, headers: this.corsHeaders }
        );
      }
      
      // Check if user is a member of the organization
      const memberResult = await this.backendService.queryFirst(
        `SELECT 1 FROM ORG_MEMBER WHERE orgID = ? AND userID = ?`,
        [orgId, userId]
      );
      
      return new Response(
        JSON.stringify({
          success: true,
          isMember: !!memberResult
        }),
        { headers: this.corsHeaders }
      );
    } catch (error) {
      console.error("Error in checkMembership:", error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message 
        }), 
        { status: 500, headers: this.corsHeaders }
      );
    }
  }

  /**
   * Handle organization membership (join/leave)
   * @param {Request} request - The request object
   * @returns {Response} JSON response with result
   */
  async handleMembership(request) {
    try {
      const data = await request.json();
      const { orgID, userID, action } = data;
      
      if (!orgID || !userID || !action) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Missing required fields: orgID, userID, and action"
          }),
          { status: 400, headers: this.corsHeaders }
        );
      }
      
      // Validate action
      if (action !== 'join' && action !== 'leave') {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Invalid action. Must be 'join' or 'leave'"
          }),
          { status: 400, headers: this.corsHeaders }
        );
      }
      
      // Check if the organization exists
      const organization = await this.backendService.queryFirst(
        "SELECT * FROM ORGANIZATION WHERE orgID = ?",
        [orgID]
      );
      
      if (!organization) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Organization not found"
          }),
          { status: 404, headers: this.corsHeaders }
        );
      }
      
      if (action === 'join') {
        // First check if the user is already a member
        const existingMembership = await this.backendService.queryFirst(
          "SELECT 1 FROM ORG_MEMBER WHERE orgID = ? AND userID = ?",
          [orgID, userID]
        );
        
        if (existingMembership) {
          return new Response(
            JSON.stringify({
              success: true,
              message: "User is already a member of this organization"
            }),
            { headers: this.corsHeaders }
          );
        }
        
        // Add user to organization
        await this.backendService.query(
          "INSERT INTO ORG_MEMBER (orgID, userID) VALUES (?, ?)",
          [orgID, userID]
        );
        
        return new Response(
          JSON.stringify({
            success: true,
            message: "Successfully joined the organization"
          }),
          { headers: this.corsHeaders }
        );
      } else {
        // action === 'leave'
        // Check if the user is already an admin
        const isAdmin = await this.backendService.queryFirst(
          "SELECT 1 FROM ORG_ADMIN WHERE orgID = ? AND userID = ?",
          [orgID, userID]
        );
        
        if (isAdmin) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Admins cannot leave an organization. Transfer ownership first."
            }),
            { status: 400, headers: this.corsHeaders }
          );
        }
        
        // Remove user from organization
        await this.backendService.query(
          "DELETE FROM ORG_MEMBER WHERE orgID = ? AND userID = ?",
          [orgID, userID]
        );
        
        return new Response(
          JSON.stringify({
            success: true,
            message: "Successfully left the organization"
          }),
          { headers: this.corsHeaders }
        );
      }
    } catch (error) {
      console.error("Error in handleMembership:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message
        }),
        { status: 500, headers: this.corsHeaders }
      );
    }
  }

  /**
   * Update organization details
   * @param {number} orgId - The organization ID
   * @param {Request} request - The request object
   * @returns {Response} JSON response with result
   */
  async updateOrganization(orgId, request) {
    try {
      // Verify authorization
      const auth = this.auth.getAuthFromRequest(request);
      if (!auth.isAuthenticated) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Authentication required" 
        }), { status: 401, headers: this.corsHeaders });
      }
      
      // Parse form data
      const formData = await formDataUtil.parseFormData(request);
      const name = formData.get('name');
      const description = formData.get('description') || '';
      const privacy = formData.get('privacy') || 'public';
      
      if (!name) {
        return new Response(JSON.stringify({
          success: false,
          error: "Organization name is required"
        }), { status: 400, headers: this.corsHeaders });
      }
      
      // Verify user is an admin
      const isAdmin = await this.backendService.queryFirst(
        "SELECT 1 FROM ORG_ADMIN WHERE orgID = ? AND userID = ?",
        [orgId, auth.userId]
      );
      
      if (!isAdmin) {
        return new Response(JSON.stringify({
          success: false,
          error: "Only administrators can update the organization"
        }), { status: 403, headers: this.corsHeaders });
      }
      
      // Check if name already exists for another organization
      const existingOrg = await this.backendService.queryFirst(
        "SELECT * FROM ORGANIZATION WHERE name = ? AND orgID != ?",
        [name, orgId]
      );
      
      if (existingOrg) {
        return new Response(JSON.stringify({
          success: false,
          error: "An organization with this name already exists"
        }), { status: 400, headers: this.corsHeaders });
      }
      
      // Process images if provided
      let thumbnailUpdate = '', thumbnailParams = [];
      let bannerUpdate = '', bannerParams = [];
      
      const thumbnail = formData.get('thumbnail');
      if (thumbnail && thumbnail.size > 0) {
        const cleanName = name.replace(/\s+/g, '_');
        const thumbnailURL = await this.backendService.uploadFile(thumbnail, `thumbnails/Thumb_${cleanName}`);
        thumbnailUpdate = ', thumbnail = ?';
        thumbnailParams.push(thumbnailURL);
      }
      
      const banner = formData.get('banner');
      if (banner && banner.size > 0) {
        const cleanName = name.replace(/\s+/g, '_');
        const bannerURL = await this.backendService.uploadFile(banner, `banners/Banner_${cleanName}`);
        bannerUpdate = ', banner = ?';
        bannerParams.push(bannerURL);
      }
      
      // Update organization
      await this.backendService.query(
        `UPDATE ORGANIZATION 
         SET name = ?, description = ?, privacy = ?${thumbnailUpdate}${bannerUpdate}
         WHERE orgID = ?`,
        [name, description, privacy, ...thumbnailParams, ...bannerParams, orgId]
      );
      
      return new Response(JSON.stringify({
        success: true,
        message: "Organization updated successfully"
      }), { headers: this.corsHeaders });
      
    } catch (error) {
      console.error("Error updating organization:", error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), { status: 500, headers: this.corsHeaders });
    }
  }

  /**
   * Get organization members
   * @param {number} orgId - The organization ID
   * @param {Request} request - The request object
   * @returns {Response} JSON response with members
   */
  async getOrganizationMembers(orgId, request) {
    try {
// console.log(`Getting members for organization ${orgId}`);
      
      // Verify authentication
      const auth = this.auth.getAuthFromRequest(request);
      if (!auth.isAuthenticated) {
// console.log("Authentication failed");
        return new Response(JSON.stringify({
          success: false,
          error: "Authentication required"
        }), { status: 401, headers: this.corsHeaders });
      }
      
      // Convert orgId to integer to ensure correct comparison with database
      const orgIdInt = parseInt(orgId, 10);
      
      // First check if organization exists
      const org = await this.backendService.queryFirst(
        "SELECT o.orgID FROM ORGANIZATION o WHERE o.orgID = ?",
        [orgIdInt]
      );
      
      if (!org) {
// console.log(`Organization ${orgId} not found`);
        return new Response(JSON.stringify({
          success: false,
          error: "Organization not found"
        }), { status: 404, headers: this.corsHeaders });
      }
      
      // Get members by joining ORG_MEMBER with USERS
      const members = await this.backendService.query(
        `SELECT u.userID, u.email, u.f_name as firstName, u.l_name as lastName, 
         u.profile_picture as profileImage
         FROM ORG_MEMBER om
         JOIN USERS u ON om.userID = u.userID
         WHERE om.orgID = ?
         ORDER BY u.f_name, u.l_name`,
        [orgIdInt]
      );
      
// console.log(`Found ${members.results ? members.results.length : 0} members`);
      
      return new Response(JSON.stringify({
        success: true,
        members: members.results || []
      }), { headers: this.corsHeaders });
      
    } catch (error) {
      console.error("Error in getOrganizationMembers:", error);
      return new Response(JSON.stringify({ 
        success: false,
        error: "Internal server error: " + error.message
      }), { status: 500, headers: this.corsHeaders });
    }
  }

  /**
   * Remove a member from an organization
   * @param {number} orgId - The organization ID
   * @param {number} memberId - The member user ID
   * @param {Request} request - The request object
   * @returns {Response} JSON response with result
   */
  async removeMember(orgId, memberId, request) {
    try {
      // Verify authorization
      const auth = this.auth.getAuthFromRequest(request);
      if (!auth.isAuthenticated) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Authentication required" 
        }), { status: 401, headers: this.corsHeaders });
      }
      
      // Verify user is an admin
      const isAdmin = await this.backendService.queryFirst(
        "SELECT 1 FROM ORG_ADMIN WHERE orgID = ? AND userID = ?",
        [orgId, auth.userId]
      );
      
      if (!isAdmin) {
        return new Response(JSON.stringify({
          success: false,
          error: "Only administrators can remove members"
        }), { status: 403, headers: this.corsHeaders });
      }
      
      // Check if member is also an admin
      const isMemberAdmin = await this.backendService.queryFirst(
        "SELECT 1 FROM ORG_ADMIN WHERE orgID = ? AND userID = ?",
        [orgId, memberId]
      );
      
      if (isMemberAdmin) {
        return new Response(JSON.stringify({
          success: false,
          error: "Cannot remove an administrator. Remove admin privileges first."
        }), { status: 400, headers: this.corsHeaders });
      }
      
      // Remove member
      await this.backendService.query(
        "DELETE FROM ORG_MEMBER WHERE orgID = ? AND userID = ?",
        [orgId, memberId]
      );
      
      return new Response(JSON.stringify({
        success: true,
        message: "Member removed successfully"
      }), { headers: this.corsHeaders });
      
    } catch (error) {
      console.error("Error removing member:", error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), { status: 500, headers: this.corsHeaders });
    }
  }

  /**
   * Add an admin to an organization
   * @param {number} orgId - The organization ID
   * @param {Request} request - The request object
   * @returns {Response} JSON response with result
   */
  async addAdmin(orgId, request) {
    try {
// console.log("Entering addAdmin for org", orgId);
      // Verify authorization
      const auth = this.auth.getAuthFromRequest(request);
      if (!auth.isAuthenticated) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Authentication required" 
        }), { status: 401, headers: this.corsHeaders });
      }
// console.log("Auth user ID:", auth.userId, "Number(auth.userId):", Number(auth.userId));
      const adminResult = await this.backendService.queryFirst(
        "SELECT 1 AS isAdmin FROM ORG_ADMIN WHERE orgID = ? AND userID = ?",
        [Number(orgId), Number(auth.userId)]
      );
      
// console.log("Admin check result (raw):", adminResult, "Keys:", adminResult ? Object.keys(adminResult) : "none");
      
      if (!adminResult || !adminResult.isAdmin) {
        return new Response(JSON.stringify({
          success: false,
          error: "Only administrators can add new admins"
        }), { status: 403, headers: this.corsHeaders });
      }
      
      // Get request data
      const { email, eventAdmin } = await request.json();
      
      if (!email) {
        return new Response(JSON.stringify({
          success: false,
          error: "Email address is required"
        }), { status: 400, headers: this.corsHeaders });
      }
      
      // Find user by email
      const user = await this.backendService.queryFirst(
        "SELECT * FROM USERS WHERE email = ?",
        [email]
      );
      
      if (!user) {
        return new Response(JSON.stringify({
          success: false,
          error: "User not found with this email address"
        }), { status: 404, headers: this.corsHeaders });
      }
      
      // Check if already an admin
      const alreadyAdmin = await this.backendService.queryFirst(
        "SELECT 1 FROM ORG_ADMIN WHERE orgID = ? AND userID = ?",
        [orgId, user.userID]
      );
      
      if (alreadyAdmin) {
        return new Response(JSON.stringify({
          success: false,
          error: "This user is already an administrator"
        }), { status: 400, headers: this.corsHeaders });
      }
      
      // Add as admin
      await this.backendService.query(
        "INSERT INTO ORG_ADMIN (orgID, userID) VALUES (?, ?)",
        [orgId, user.userID]
      );
      
      // Also add as member if not already
      const isMember = await this.backendService.queryFirst(
        "SELECT 1 FROM ORG_MEMBER WHERE orgID = ? AND userID = ?",
        [orgId, user.userID]
      );
      
      if (!isMember) {
        await this.backendService.query(
          "INSERT INTO ORG_MEMBER (orgID, userID) VALUES (?, ?)",
          [orgId, user.userID]
        );
      }
      
      // Return admin details
      const admin = {
        userID: user.userID,
        email: user.email,
        firstName: user.f_name,
        lastName: user.l_name,
        profileImage: user.profile_picture,
        eventAdmin: !!eventAdmin
      };
      
      return new Response(JSON.stringify({
        success: true,
        message: "Administrator added successfully",
        admin
      }), { headers: this.corsHeaders });
      
    } catch (error) {
      console.error("Error adding admin:", error.stack || error.message);
      return new Response(JSON.stringify({
        success: false,
        error: error.stack || error.message
      }), { status: 500, headers: this.corsHeaders });
    }
  }

  /**
   * Remove an admin from an organization
   * @param {number} orgId - The organization ID
   * @param {number} adminId - The admin user ID
   * @param {Request} request - The request object
   * @returns {Response} JSON response with result
   */
  async removeAdmin(orgId, adminId, request) {
    try {
      // Verify authorization
      const auth = this.auth.getAuthFromRequest(request);
      if (!auth.isAuthenticated) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Authentication required" 
        }), { status: 401, headers: this.corsHeaders });
      }
      
      // Verify user is an admin
      const isAdmin = await this.backendService.queryFirst(
        "SELECT 1 FROM ORG_ADMIN WHERE orgID = ? AND userID = ?",
        [orgId, auth.userId]
      );
      
      if (!isAdmin) {
        return new Response(JSON.stringify({
          success: false,
          error: "Only administrators can remove admins"
        }), { status: 403, headers: this.corsHeaders });
      }
      
      // Prevent removing yourself
      if (adminId == auth.userId) {
        return new Response(JSON.stringify({
          success: false,
          error: "You cannot remove yourself as an administrator"
        }), { status: 400, headers: this.corsHeaders });
      }
      
      // Check admin count - don't allow removing the last admin
      const adminCount = await this.backendService.queryFirst(
        "SELECT COUNT(*) as count FROM ORG_ADMIN WHERE orgID = ?",
        [orgId]
      );
      
      if (adminCount.count <= 1) {
        return new Response(JSON.stringify({
          success: false,
          error: "Cannot remove the only administrator. Add another admin first."
        }), { status: 400, headers: this.corsHeaders });
      }
      
      // Remove admin privileges
      await this.backendService.query(
        "DELETE FROM ORG_ADMIN WHERE orgID = ? AND userID = ?",
        [orgId, adminId]
      );
      
      return new Response(JSON.stringify({
        success: true,
        message: "Administrator removed successfully"
      }), { headers: this.corsHeaders });
      
    } catch (error) {
      console.error("Error removing admin:", error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), { status: 500, headers: this.corsHeaders });
    }
  }

  /**
   * Delete an organization with the given ID
   */
  async deleteOrganization(orgId, request) {
    try {
      // Check authentication
      const { isAuthenticated, userId } = this.auth.getAuthFromRequest(request);
      
      if (!isAuthenticated) {
        return new Response(JSON.stringify({
          success: false,
          error: "Authentication required"
        }), { status: 401, headers: this.corsHeaders });
      }
      
      // Parse request body to get userID if different from token
      const body = await request.json();
      const requestedUserId = body.userID || userId;
      
      // Check if user is an admin of the organization
      const isAdmin = await this.backendService.queryFirst(
        "SELECT 1 FROM ORG_ADMIN WHERE orgID = ? AND userID = ?",
        [orgId, requestedUserId]
      );
      
      if (!isAdmin) {
        return new Response(JSON.stringify({
          success: false,
          error: "Only organization admins can delete organizations"
        }), { status: 403, headers: this.corsHeaders });
      }
      
      // Check if organization exists
      const org = await this.backendService.queryFirst(
        "SELECT * FROM ORGANIZATION WHERE orgID = ?",
        [orgId]
      );
      
      if (!org) {
        return new Response(JSON.stringify({
          success: false,
          error: "Organization not found"
        }), { status: 404, headers: this.corsHeaders });
      }
      
      // First, delete related records in tables with foreign keys
      
      // Delete organization from OFFICIAL_PENDING table
      await this.backendService.query(
        "DELETE FROM OFFICIAL_PENDING WHERE orgID = ?",
        [orgId]
      );
      
      // Delete organization from OFFICIAL table if it exists
      await this.backendService.query(
        "DELETE FROM OFFICIAL WHERE orgID = ?",
        [orgId]
      );
      
      // Remove any org admins
      await this.backendService.query(
        "DELETE FROM ORG_ADMIN WHERE orgID = ?",
        [orgId]
      );
      
      // Remove any org members
      await this.backendService.query(
        "DELETE FROM ORG_MEMBER WHERE orgID = ?",
        [orgId]
      );
      
      // Get all associated events to delete them too
      const events = await this.backendService.query(
        "SELECT eventID FROM EVENT WHERE organizationID = ?",
        [orgId]
      );
      
      // Delete events associated with this organization
      if (events && events.results && events.results.length > 0) {
        for (const event of events.results) {
          await this.backendService.query(
            "DELETE FROM EVENT_RSVP WHERE eventID = ?",
            [event.eventID]
          );
          
          await this.backendService.query(
            "DELETE FROM EVENT_ADMIN WHERE eventID = ?",
            [event.eventID]
          );
          
          await this.backendService.query(
            "DELETE FROM OFFICIAL_PENDING WHERE eventID = ?",
            [event.eventID]
          );
          
          await this.backendService.query(
            "DELETE FROM OFFICIAL WHERE eventID = ?",
            [event.eventID]
          );
          
          await this.backendService.query(
            "DELETE FROM EVENT WHERE eventID = ?",
            [event.eventID]
          );
        }
      }
      
      // Finally, delete the organization itself
      await this.backendService.query(
        "DELETE FROM ORGANIZATION WHERE orgID = ?",
        [orgId]
      );
      
      return new Response(JSON.stringify({
        success: true,
        message: "Organization and all associated data deleted successfully"
      }), { headers: this.corsHeaders });
    } catch (error) {
      console.error('Error deleting organization:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), { status: 500, headers: this.corsHeaders });
    }
  }

  /**
   * Gets a list of official organizations
   */
  async getOfficialOrganizations(request) {
    try {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '10');
      
      // Query to get organizations with official status
      const query = `
        SELECT o.*
        FROM ORGANIZATION o
        JOIN OFFICIAL of ON o.orgID = of.orgID
        WHERE of.orgID IS NOT NULL
        LIMIT ?
      `;
      
      const organizations = await this.backendService.query(query, [limit]);
      
      return new Response(JSON.stringify({
        success: true,
        organizations: organizations.results || []
      }), { headers: this.corsHeaders });
    } catch (error) {
      console.error('Error fetching official organizations:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), { status: 500, headers: this.corsHeaders });
    }
  }
}

export default OrganizationController;