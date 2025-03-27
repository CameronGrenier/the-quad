import * as Utils from '../utils/auth.js';
import * as DatabaseService from '../services/DatabaseService.js';
import * as BackendService from '../services/BackendService.js';

/**
 * EventController class handles event-related endpoints
 */
export class EventController {
  constructor(env, corsHeaders) {
    this.env = env;
    this.corsHeaders = corsHeaders;
  }

  /**
   * Registers a new event
   * @param {Request} request - The incoming request object
   * @returns {Promise<Response>} - The response object
   */
  async registerEvent(request) {
    return BackendService.handleRequest(request, async (req) => {
      const formData = await Utils.parseFormData(req);
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
        throw new Error('Organization ID, title, start date, end date and user ID are required');
      }
      // Verify admin rights
      const isAdmin = await DatabaseService.query(this.env, `
        SELECT 1 FROM ORG_ADMIN
        WHERE orgID = ? AND userID = ?
      `, [organizationID, userID]);
      if (isAdmin.length === 0) {
        throw new Error('User is not an admin of this organization');
      }
      let thumbnailURL = '', bannerURL = '';
      const thumbnail = formData.get('thumbnail');
      if (thumbnail && thumbnail.size > 0) {
        thumbnailURL = await Utils.uploadFileToR2(this.env, thumbnail, `events/thumbnails/${title}-${Date.now()}`);
      }
      const banner = formData.get('banner');
      if (banner && banner.size > 0) {
        bannerURL = await Utils.uploadFileToR2(this.env, banner, `events/banners/${title}-${Date.now()}`);
      }
      const insertResult = await DatabaseService.execute(this.env, `
        INSERT INTO EVENT (
          organizationID, title, description, thumbnail, banner,
          startDate, endDate, privacy, officialStatus, landmarkID,
          customLocation
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        organizationID, title, description, thumbnailURL, bannerURL,
        startDate, endDate, privacy, submitForOfficialStatus ? 1 : 0,
        landmarkID, customLocation
      ]);
      const newEventID = insertResult.meta.last_row_id;
      await DatabaseService.execute(this.env, `
        INSERT INTO EVENT_ADMIN (eventID, userID)
        VALUES (?, ?)
      `, [newEventID, userID]);
      return {
        success: true,
        message: "Event created successfully",
        eventID: newEventID
      };
    });
  }

  /**
   * Gets all events
   * @param {Request} request - The incoming request object
   * @returns {Promise<Response>} - The response object
   */
  async getAllEvents(request) {
    return BackendService.handleRequest(request, async (req) => {
      // Get all events with organization names included
      const events = await DatabaseService.query(this.env, `
        SELECT e.*, o.name as organizationName
        FROM EVENT e
        JOIN ORGANIZATION o ON e.organizationID = o.orgID
        ORDER BY e.startDate ASC
      `);
      return {
        success: true,
        events: events || []
      };
    });
  }
}