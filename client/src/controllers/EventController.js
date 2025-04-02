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
  
  /**
   * Get all events with optional filtering
   * @param {Request} request - The request object
   * @returns {Response} JSON response with events
   */
  async getAllEvents(request) {
    try {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const organizationID = url.searchParams.get('organizationID');
      
      let query = `
        SELECT e.*, o.name as organizationName 
        FROM EVENT e
        JOIN ORGANIZATION o ON e.organizationID = o.orgID
      `;
      
      const params = [];
      
      if (organizationID) {
        query += ` WHERE e.organizationID = ?`;
        params.push(organizationID);
      }
      
      query += ` ORDER BY e.startDate DESC LIMIT ?`;
      params.push(limit);
      
      const eventsResult = await this.backendService.queryAll(query, params);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          events: eventsResult.results || [] 
        }), 
        { headers: this.corsHeaders }
      );
    } catch (error) {
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
   * Get a specific event by ID
   * @param {number} eventId - The event ID to retrieve
   * @returns {Response} JSON response with event details
   */
  async getEventById(eventId) {
    try {
      // Get the event details
      const eventQuery = `
        SELECT e.*, o.name as organizationName 
        FROM EVENT e
        JOIN ORGANIZATION o ON e.organizationID = o.orgID
        WHERE e.eventID = ?
      `;
      
      const event = await this.backendService.queryFirst(eventQuery, [eventId]);
      
      if (!event) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Event not found" 
          }), 
          { status: 404, headers: this.corsHeaders }
        );
      }
      
      // If there's a landmarkID, fetch the landmark name too
      if (event.landmarkID) {
        const landmarkQuery = `SELECT name FROM LANDMARK WHERE landmarkID = ?`;
        const landmark = await this.backendService.queryFirst(landmarkQuery, [event.landmarkID]);
        if (landmark) {
          event.landmarkName = landmark.name;
        }
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          event 
        }), 
        { headers: this.corsHeaders }
      );
    } catch (error) {
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

export default EventController;