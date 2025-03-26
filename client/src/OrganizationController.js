/*
 -------------------------------------------------------
 File:     OrganizationController.js
 About:    Organization controller for the client side
 Author:   Humayoyun Khan
 Version:  2025-03-02
 -------------------------------------------------------
 */

import { Utils } from './utils.js';

/**
 * OrganizationController class handles organization-related API endpoints.
 */
export class OrganizationController {
  constructor(env, corsHeaders) {
    this.env = env;
    this.corsHeaders = corsHeaders;
  }

  /**
   * Registers a new organization.
   * @param {Request} request - The incoming request object.
   * @returns {Promise<Response>} - The response object.
   */
  async registerOrganization(request) {
    try {
      const formData = await Utils.parseFormData(request);
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

  /**
   * Retrieves organizations for a specific user.
   * @param {Request} request - The incoming request object.
   * @returns {Promise<Response>} - The response object.
   */
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

  /**
   * Retrieves all organizations.
   * @param {Request} request - The incoming request object.
   * @returns {Promise<Response>} - The response object.
   */
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

  /**
   * Retrieves a specific organization by ID.
   * @param {number} orgId - The ID of the organization.
   * @returns {Promise<Response>} - The response object.
   */
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

  /**
   * Retrieves events for a specific organization.
   * @param {number} orgId - The ID of the organization.
   * @returns {Promise<Response>} - The response object.
   */
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

  /**
   * Deletes an organization.
   * @param {Request} request - The incoming request object.
   * @param {number} orgId - The ID of the organization to delete.
   * @returns {Promise<Response>} - The response object.
   */
  async deleteOrganization(request, orgId) {
    try {
      const authHeader = request.headers.get('Authorization') || '';
      if (!authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({
          success: false,
          error: "Authentication required"
        }), { status: 401, headers: this.corsHeaders });
      }

      const token = authHeader.replace('Bearer ', '');
      let payload;
      try {
        payload = Utils.verifyJWT(token);
      } catch (err) {
        return new Response(JSON.stringify({
          success: false,
          error: "Invalid authentication token"
        }), { status: 401, headers: this.corsHeaders });
      }

      const userData = await request.json();
      const userID = userData.userID;
      if (!userID) {
        return new Response(JSON.stringify({
          success: false,
          error: "User ID is required"
        }), { status: 400, headers: this.corsHeaders });
      }

      const isAdmin = await this.env.D1_DB.prepare(`
        SELECT 1 FROM ORG_ADMIN
        WHERE orgID = ? AND userID = ?
      `).bind(orgId, userID).first();
      if (!isAdmin) {
        return new Response(JSON.stringify({
          success: false,
          error: "You don't have permission to delete this organization"
        }), { status: 403, headers: this.corsHeaders });
      }

      const statements = [
        this.env.D1_DB.prepare(`
          DELETE FROM EVENT_ADMIN 
          WHERE eventID IN (SELECT eventID FROM EVENT WHERE organizationID = ?)
        `).bind(orgId),
        this.env.D1_DB.prepare(
          "DELETE FROM EVENT WHERE organizationID = ?"
        ).bind(orgId),
        this.env.D1_DB.prepare(
          "DELETE FROM ORG_ADMIN WHERE orgID = ?"
        ).bind(orgId),
        this.env.D1_DB.prepare(
          "DELETE FROM ORG_MEMBER WHERE orgID = ?"
        ).bind(orgId),
        this.env.D1_DB.prepare(
          "DELETE FROM ORGANIZATION WHERE orgID = ?"
        ).bind(orgId)
      ];

      await this.env.D1_DB.batch(statements);

      return new Response(JSON.stringify({
        success: true,
        message: "Organization deleted successfully"
      }), { headers: this.corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), { status: 500, headers: this.corsHeaders });
    }
  }
}