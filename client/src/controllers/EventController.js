/**
 * Event Controller for The Quad
 * 
 * Handles event operations like creation, retrieval, and management
 */

import formDataUtil from '../utils/formData.js';

class EventController {
  constructor(env, corsHeaders, backendService, auth) {
    this.env = env;
    this.corsHeaders = corsHeaders;
    this.backendService = backendService;
    this.auth = auth;
  }
  
  async registerEvent(request) {
    try {
      const formData = await formDataUtil.parseFormData(request);
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
        const sanitizedTitle = title.replace(/\s+/g, '_');
        thumbnailURL = await this.backendService.uploadFile(
          thumbnail, 
          `events/thumbnails/${sanitizedTitle}-${Date.now()}`
        );
      }
      
      const banner = formData.get('banner');
      if (banner && banner.size > 0) {
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

export default EventController;