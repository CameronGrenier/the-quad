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
      
      // Upload thumbnail and banner if provided
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
          startDate, endDate, privacy, landmarkID,
          customLocation
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          organizationID, title, description, thumbnailURL, bannerURL,
          startDate, endDate, privacy, landmarkID, customLocation
        ]
      );
      
      const newEventID = insertResult.meta.last_row_id;
      await this.backendService.query(
        `INSERT INTO EVENT_ADMIN (eventID, userID) VALUES (?, ?)`,
        [newEventID, userID]
      );
      
      // Add to OFFICIAL_PENDING if requested
      if (submitForOfficialStatus) {
        await this.backendService.query(
          `INSERT INTO OFFICIAL_PENDING (orgID, eventID) VALUES (NULL, ?)`,
          [newEventID]
        );
        console.log(`Added event ${newEventID} to OFFICIAL_PENDING table`);
      }
      
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
  
  /**
   * Handle event RSVP (create or update)
   * @param {number} eventId - Event ID to RSVP for
   * @param {Request} request - The request containing RSVP data
   * @returns {Response} JSON response
   */
  async handleEventRSVP(eventId, request) {
    try {
      // Verify authorization
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '');
      
      if (!token) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Authentication required" 
          }), 
          { status: 401, headers: this.corsHeaders }
        );
      }
      
      // Get user from token
      const userData = this.auth.verifyJWT(token);
      const userId = userData.userId;
      
      if (!userId) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Invalid authentication token" 
          }), 
          { status: 401, headers: this.corsHeaders }
        );
      }
      
      // Verify event exists
      const event = await this.backendService.queryFirst(
        "SELECT * FROM EVENT WHERE eventID = ?", 
        [eventId]
      );
      
      if (!event) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Event not found" 
          }), 
          { status: 404, headers: this.corsHeaders }
        );
      }
      
      // Get RSVP data from request
      const data = await request.json();
      const rsvpStatus = data.rsvpStatus; // 'attending', 'maybe', or 'declined'
      
      if (!['attending', 'maybe', 'declined'].includes(rsvpStatus)) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Invalid RSVP status. Must be 'attending', 'maybe', or 'declined'." 
          }), 
          { status: 400, headers: this.corsHeaders }
        );
      }
      
      // Check if RSVP already exists
      const existingRSVP = await this.backendService.queryFirst(
        "SELECT * FROM EVENT_RSVP WHERE eventID = ? AND userID = ?",
        [eventId, userId]
      );
      
      if (existingRSVP) {
        // Update existing RSVP - use rsvpStatus column name instead of status
        await this.backendService.query(
          "UPDATE EVENT_RSVP SET rsvpStatus = ? WHERE eventID = ? AND userID = ?",
          [rsvpStatus, eventId, userId]
        );
      } else {
        // Create new RSVP - use rsvpStatus column name instead of status
        await this.backendService.query(
          "INSERT INTO EVENT_RSVP (eventID, userID, rsvpStatus) VALUES (?, ?, ?)",
          [eventId, userId, rsvpStatus]
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `RSVP ${existingRSVP ? 'updated' : 'created'} successfully`,
          rsvpStatus
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
   * Get RSVP status for a user and event
   * @param {number} eventId - Event ID to check
   * @param {Request} request - The request object with auth headers
   * @returns {Response} JSON response with RSVP status
   */
  async getRSVPStatus(eventId, request) {
    try {
      // Verify authorization
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '');
      
      if (!token) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Authentication required" 
          }), 
          { status: 401, headers: this.corsHeaders }
        );
      }
      
      // Get user from token
      const userData = this.auth.verifyJWT(token);
      const userId = userData.userId;
      
      if (!userId) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Invalid authentication token" 
          }), 
          { status: 401, headers: this.corsHeaders }
        );
      }
      
      // Get RSVP status - use rsvpStatus column name instead of status
      const rsvp = await this.backendService.queryFirst(
        "SELECT rsvpStatus FROM EVENT_RSVP WHERE eventID = ? AND userID = ?",
        [eventId, userId]
      );
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          rsvpStatus: rsvp ? rsvp.rsvpStatus : null 
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
   * Get events associated with the authenticated user
   * (events they've created, are admin of, or have RSVP'd to)
   * @param {Request} request - The request object with auth headers
   * @returns {Response} JSON response with user's events
   */
  async getUserEvents(request) {
    try {
      // Verify authorization
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '');
      
      if (!token) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Authentication required" 
          }), 
          { status: 401, headers: this.corsHeaders }
        );
      }
      
      // Get user from token
      const userData = this.auth.verifyJWT(token);
      const userId = userData.userId;
      
      if (!userId) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Invalid authentication token" 
          }), 
          { status: 401, headers: this.corsHeaders }
        );
      }
      
      console.log("Fetching events for user ID:", userId);
      
      // Get events that the user is admin of
      const adminQuery = `
        SELECT e.*, o.name as organizationName, 'admin' as role
        FROM EVENT e
        JOIN ORGANIZATION o ON e.organizationID = o.orgID
        JOIN EVENT_ADMIN ea ON e.eventID = ea.eventID
        WHERE ea.userID = ?
      `;
      
      // Get events that the user has RSVP'd to - IMPORTANT: Add both rsvpStatus and role fields
      const rsvpQuery = `
        SELECT e.*, o.name as organizationName, er.rsvpStatus, er.rsvpStatus as role
        FROM EVENT e
        JOIN ORGANIZATION o ON e.organizationID = o.orgID
        JOIN EVENT_RSVP er ON e.eventID = er.eventID
        WHERE er.userID = ?
      `;
      
      const [adminEvents, rsvpEvents] = await Promise.all([
        this.backendService.queryAll(adminQuery, [userId]),
        this.backendService.queryAll(rsvpQuery, [userId])
      ]);
      
      console.log("Admin events:", adminEvents.results?.length || 0);
      console.log("RSVP events:", rsvpEvents.results?.length || 0);
      
      // Create a map of all events by ID to avoid duplicates
      const eventMap = new Map();
      
      // Process admin events first (admin role has priority)
      (adminEvents.results || []).forEach(event => {
        eventMap.set(event.eventID, {
          ...event,
          isOrganizer: true
        });
      });
      
      // Process RSVP events
      (rsvpEvents.results || []).forEach(event => {
        if (eventMap.has(event.eventID)) {
          // If already added as admin event, just add the rsvpStatus
          const existingEvent = eventMap.get(event.eventID);
          eventMap.set(event.eventID, {
            ...existingEvent,
            rsvpStatus: event.rsvpStatus
          });
        } else {
          // Add as new event
          eventMap.set(event.eventID, {
            ...event,
            isOrganizer: false
          });
        }
      });
      
      // Convert to array
      const events = Array.from(eventMap.values());
      console.log("Final events count:", events.length);
      
      // Sort by start date (newest first)
      events.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          events
        }), 
        { headers: this.corsHeaders }
      );
    } catch (error) {
      console.error("Error in getUserEvents:", error);
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
   * Gets a list of official events
   */
  async getOfficialEvents(request) {
    try {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '4');
      const showPast = url.searchParams.get('showPast') === 'true';
      
      // Base query to get events with official status
      let query = `
        SELECT e.*, o.name as organizationName
        FROM EVENT e
        JOIN OFFICIAL of ON e.eventID = of.eventID
        LEFT JOIN ORGANIZATION o ON e.organizationID = o.orgID
        WHERE of.eventID IS NOT NULL
      `;
      
      // Filter out past events if not explicitly requested
      if (!showPast) {
        query += ` AND e.endDate >= datetime('now')`;
      }
      
      // Order by start date (upcoming first)
      query += ` ORDER BY e.startDate ASC LIMIT ?`;
      
      const events = await this.backendService.query(query, [limit]);
      
      return new Response(JSON.stringify({
        success: true,
        events: events.results || []
      }), { headers: this.corsHeaders });
    } catch (error) {
      console.error('Error fetching official events:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), { status: 500, headers: this.corsHeaders });
    }
  }
}

export default EventController;