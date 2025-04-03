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
}

export default OrganizationController;