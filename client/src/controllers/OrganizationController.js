/*
 -------------------------------------------------------
 File:     OrganizationController.js
 About:    Organization controller for the client side
 Author:   Humayoyun Khan, Cameron Grenier
 Version:  2025-03-02
 -------------------------------------------------------
 */

 import * as Utils from '../utils/auth.js';
 import * as DatabaseService from '../services/DatabaseService.js';
 import * as BackendService from '../services/BackendService.js';
 import { parseFormData } from '../utils/formData.js';
 import { uploadFileToR2 } from '../utils/storage.js';

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
    return BackendService.handleRequest(request, async (req) => {
      const formData = await parseFormData(req);
      const name = formData.get('name');
      const description = formData.get('description') || '';
      const userID = formData.get('userID');
      const privacy = formData.get('privacy') || 'public';

      if (!name || !userID) {
        throw new Error("Missing required fields: name and userID");
      }

      const existingOrg = await DatabaseService.query(this.env, 
        "SELECT * FROM ORGANIZATION WHERE name = ?", [name]);
      if (existingOrg.length > 0) {
        throw new Error("Organization name already exists");
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

      const insertResult = await DatabaseService.execute(this.env, `
        INSERT INTO ORGANIZATION (name, description, thumbnail, banner, privacy)
        VALUES (?, ?, ?, ?, ?)
      `, [name, description, thumbnailURL, bannerURL, privacy]);
      const newOrgID = insertResult.meta.last_row_id;
      await DatabaseService.execute(this.env, `
        INSERT INTO ORG_ADMIN (orgID, userID)
        VALUES (?, ?)
      `, [newOrgID, userID]);

      return {
        success: true,
        message: "Organization created successfully",
        orgID: newOrgID
      };
    });
  }

  /**
   * Retrieves organizations for a specific user.
   * @param {Request} request - The incoming request object.
   * @returns {Promise<Response>} - The response object.
   */
  async getUserOrganizations(request) {
    return BackendService.handleRequest(request, async (req) => {
      const url = new URL(req.url);
      const userID = url.searchParams.get('userID');
      if (!userID) {
        throw new Error("User ID is required");
      }
      const results = await DatabaseService.query(this.env, `
        SELECT o.* FROM ORGANIZATION o
        JOIN ORG_ADMIN oa ON o.orgID = oa.orgID
        WHERE oa.userID = ?
      `, [userID]);
      return {
        success: true,
        organizations: results || []
      };
    });
  }

  /**
   * Retrieves all organizations.
   * @param {Request} request - The incoming request object.
   * @returns {Promise<Response>} - The response object.
   */
  async getAllOrganizations(request) {
    return BackendService.handleRequest(request, async (req) => {
      const organizations = await DatabaseService.query(this.env, `
        SELECT o.*, COUNT(om.userID) as memberCount
        FROM ORGANIZATION o
        LEFT JOIN ORG_MEMBER om ON o.orgID = om.orgID
        GROUP BY o.orgID
        ORDER BY o.name ASC
      `);
      return {
        success: true,
        organizations: organizations || []
      };
    });
  }

  /**
   * Retrieves a specific organization by ID.
   * @param {Request} request - The incoming request object.
   * @param {number} orgId - The ID of the organization.
   * @returns {Promise<Response>} - The response object.
   */
  async getOrganization(request, orgId) {
    return BackendService.handleRequest(request, async (req) => {
      const organization = await DatabaseService.query(this.env, `
        SELECT o.*, COUNT(om.userID) as memberCount
        FROM ORGANIZATION o
        LEFT JOIN ORG_MEMBER om ON o.orgID = om.orgID
        WHERE o.orgID = ?
        GROUP BY o.orgID
      `, [orgId]);
      if (organization.length === 0) {
        throw new Error("Organization not found");
      }
      const admins = await DatabaseService.query(this.env, `
        SELECT u.userID as id, u.email, u.f_name as firstName, u.l_name as lastName, u.profile_picture as profileImage
        FROM ORG_ADMIN oa
        JOIN USERS u ON oa.userID = u.userID
        WHERE oa.orgID = ?
      `, [orgId]);
      organization[0].admins = admins || [];
      return {
        success: true,
        organization: organization[0]
      };
    });
  }

  /**
   * Retrieves events for a specific organization.
   * @param {Request} request - The incoming request object.
   * @param {number} orgId - The ID of the organization.
   * @returns {Promise<Response>} - The response object.
   */
  async getOrganizationEvents(request, orgId) {
    return BackendService.handleRequest(request, async (req) => {
      const events = await DatabaseService.query(this.env, `
        SELECT e.* FROM EVENT e
        WHERE e.organizationID = ?
        ORDER BY e.startDate ASC
      `, [orgId]);
      return {
        success: true,
        events: events || []
      };
    });
  }

  /**
   * Deletes an organization.
   * @param {Request} request - The incoming request object.
   * @param {number} orgId - The ID of the organization to delete.
   * @returns {Promise<Response>} - The response object.
   */
  async deleteOrganization(request, orgId) {
    return BackendService.handleRequest(request, async (req) => {
      const authHeader = req.headers.get('Authorization') || '';
      if (!authHeader.startsWith('Bearer ')) {
        throw new Error("Authentication required");
      }

      const token = authHeader.replace('Bearer ', '');
      let payload;
      try {
        payload = Utils.verifyJWT(token);
      } catch (err) {
        throw new Error("Invalid authentication token");
      }

      const userData = await req.json();
      const userID = userData.userID;
      if (!userID) {
        throw new Error("User ID is required");
      }

      const isAdmin = await DatabaseService.query(this.env, `
        SELECT 1 FROM ORG_ADMIN
        WHERE orgID = ? AND userID = ?
      `, [orgId, userID]);
      if (isAdmin.length === 0) {
        throw new Error("You don't have permission to delete this organization");
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

      return {
        success: true,
        message: "Organization deleted successfully"
      };
    });
  }
}