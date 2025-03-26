import { parseFormData } from '../utils/formData.js';
import { uploadFileToR2 } from '../utils/storage.js';
import { verifyJWT } from '../utils/auth.js';

export class OrganizationController {
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
          error: "Organization name and user ID are required"
        }), { status: 400, headers: this.corsHeaders });
      }

      const existingOrg = await this.env.D1_DB.prepare(
        "SELECT * FROM ORGANIZATION WHERE name = ?"
      ).bind(name).first();
      
      if (existingOrg) {
        return new Response(JSON.stringify({
          success: false,
          error: "An organization with this name already exists"
        }), { status: 400, headers: this.corsHeaders });
      }

      let thumbnailURL = '', bannerURL = '';
      const thumbnail = formData.get('thumbnail');
      if (thumbnail && thumbnail.size > 0) {
        const fileName = `org_thumb_${Date.now()}_${thumbnail.name.replace(/\s+/g, '_')}`;
        thumbnailURL = await uploadFileToR2(this.env, thumbnail, fileName);
      }

      const banner = formData.get('banner');
      if (banner && banner.size > 0) {
        const fileName = `org_banner_${Date.now()}_${banner.name.replace(/\s+/g, '_')}`;
        bannerURL = await uploadFileToR2(this.env, banner, fileName);
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
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '');
      if (!token) {
        return new Response(JSON.stringify({ success: false, error: "Authentication token required" }),
          { status: 401, headers: this.corsHeaders });
      }
      
      const payload = verifyJWT(token);
      const userId = payload.userId;
      
      const orgs = await this.env.D1_DB.prepare(`
        SELECT o.* FROM ORGANIZATION o
        JOIN ORG_ADMIN oa ON o.orgID = oa.orgID
        WHERE oa.userID = ?
      `).bind(userId).all();
      
      return new Response(JSON.stringify({
        success: true,
        organizations: orgs.results
      }), { headers: this.corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: this.corsHeaders });
    }
  }

  async getAllOrganizations(request) {
    try {
      const orgs = await this.env.D1_DB.prepare('SELECT * FROM ORGANIZATION').all();
      return new Response(JSON.stringify({
        success: true,
        organizations: orgs.results
      }), { headers: this.corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: this.corsHeaders });
    }
  }

  async getOrganization(orgId) {
    try {
      const org = await this.env.D1_DB.prepare(
        'SELECT * FROM ORGANIZATION WHERE orgID = ?'
      ).bind(orgId).first();
      
      if (!org) {
        return new Response(JSON.stringify({
          success: false,
          error: "Organization not found"
        }), { status: 404, headers: this.corsHeaders });
      }
      
      return new Response(JSON.stringify({
        success: true,
        organization: org
      }), { headers: this.corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: this.corsHeaders });
    }
  }

  async getOrganizationEvents(orgId) {
    try {
      const events = await this.env.D1_DB.prepare(
        'SELECT * FROM EVENT WHERE organizationID = ?'
      ).bind(orgId).all();
      
      return new Response(JSON.stringify({
        success: true,
        events: events.results
      }), { headers: this.corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: this.corsHeaders });
    }
  }

  async getUserMemberOrganizations(request) {
    // Similar implementation to getUserOrganizations can be added here.
    return new Response(JSON.stringify({ success: true, organizations: [] }), 
      { headers: this.corsHeaders });
  }

  async deleteOrganization(request, orgId) {
    try {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '');
      if (!token) {
        return new Response(JSON.stringify({ success: false, error: "Authentication token required" }),
          { status: 401, headers: this.corsHeaders });
      }
      
      const payload = verifyJWT(token);
      const userId = payload.userId;
      
      // Check if user is admin of this org
      const isAdmin = await this.env.D1_DB.prepare(
        "SELECT * FROM ORG_ADMIN WHERE orgID = ? AND userID = ?"
      ).bind(orgId, userId).first();
      
      if (!isAdmin) {
        return new Response(JSON.stringify({
          success: false,
          error: "You don't have permission to delete this organization"
        }), { status: 403, headers: this.corsHeaders });
      }
      
      // First delete all related records
      await this.env.D1_DB.prepare("DELETE FROM ORG_ADMIN WHERE orgID = ?").bind(orgId).run();
      await this.env.D1_DB.prepare("DELETE FROM EVENT WHERE organizationID = ?").bind(orgId).run();
      
      // Then delete the organization
      await this.env.D1_DB.prepare("DELETE FROM ORGANIZATION WHERE orgID = ?").bind(orgId).run();
      
      return new Response(JSON.stringify({
        success: true,
        message: "Organization deleted successfully"
      }), { headers: this.corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: this.corsHeaders });
    }
  }
}