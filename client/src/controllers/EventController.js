import { parseFormData } from '../utils/formData.js';
import { uploadFileToR2 } from '../utils/storage.js';
import { verifyJWT } from '../utils/auth.js';

export class EventController {
  constructor(env, corsHeaders) {
    this.env = env;
    this.corsHeaders = corsHeaders;
  }

  async registerEvent(request) {
    try {
      const formData = await parseFormData(request);
      const title = formData.get('title');
      const description = formData.get('description') || '';
      const organizationID = formData.get('organizationID');
      const startDate = formData.get('startDate');
      const endDate = formData.get('endDate');
      const landmarkID = formData.get('landmarkID');
      const privacy = formData.get('privacy') || 'public';
      
      // Get user ID from token
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '');
      if (!token) {
        return new Response(JSON.stringify({ success: false, error: "Authentication token required" }),
          { status: 401, headers: this.corsHeaders });
      }
      const payload = verifyJWT(token);
      const userID = payload.userId;

      if (!title || !organizationID || !startDate || !endDate) {
        return new Response(JSON.stringify({
          success: false,
          error: "Title, organization ID, start date, and end date are required"
        }), { status: 400, headers: this.corsHeaders });
      }

      // Check if user is admin of the organization
      const isAdmin = await this.env.D1_DB.prepare(
        "SELECT * FROM ORG_ADMIN WHERE orgID = ? AND userID = ?"
      ).bind(organizationID, userID).first();

      if (!isAdmin) {
        return new Response(JSON.stringify({
          success: false,
          error: "You don't have permission to create events for this organization"
        }), { status: 403, headers: this.corsHeaders });
      }

      // Upload images if provided
      let thumbnailURL = '', bannerURL = '';
      const thumbnail = formData.get('thumbnail');
      if (thumbnail && thumbnail.size > 0) {
        const fileName = `event_thumb_${Date.now()}_${thumbnail.name.replace(/\s+/g, '_')}`;
        thumbnailURL = await uploadFileToR2(this.env, thumbnail, fileName);
      }

      const banner = formData.get('banner');
      if (banner && banner.size > 0) {
        const fileName = `event_banner_${Date.now()}_${banner.name.replace(/\s+/g, '_')}`;
        bannerURL = await uploadFileToR2(this.env, banner, fileName);
      }

      // Check landmark availability (if provided)
      if (landmarkID) {
        // TODO: Implement proper availability check
        const landmark = await this.env.D1_DB.prepare(
          "SELECT * FROM LANDMARK WHERE landmarkID = ?"
        ).bind(landmarkID).first();
        
        if (!landmark) {
          return new Response(JSON.stringify({
            success: false,
            error: "Landmark not found"
          }), { status: 404, headers: this.corsHeaders });
        }
        
        // Check for conflicting events at this landmark
        if (!landmark.multiEventAllowed) {
          const conflictingEvents = await this.env.D1_DB.prepare(`
            SELECT * FROM EVENT 
            WHERE landmarkID = ? 
            AND ((startDate <= ? AND endDate >= ?) OR (startDate <= ? AND endDate >= ?))
          `).bind(landmarkID, startDate, startDate, endDate, endDate).all();
          
          if (conflictingEvents.results.length > 0) {
            return new Response(JSON.stringify({
              success: false,
              error: "Landmark is already booked for this time period"
            }), { status: 400, headers: this.corsHeaders });
          }
        }
      }

      // Insert the event
      const insertResult = await this.env.D1_DB.prepare(`
        INSERT INTO EVENT (
          title, description, organizationID, startDate, endDate,
          thumbnail, banner, privacy, landmarkID
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        title, description, organizationID, startDate, endDate,
        thumbnailURL, bannerURL, privacy, landmarkID || null
      ).run();
      
      const newEventID = insertResult.meta.last_row_id;
      
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

  // Additional methods could be implemented here:
  // - getEvent(eventId)
  // - updateEvent(eventId, request)
  // - deleteEvent(eventId)
  // - rsvpToEvent(eventId, status)
}