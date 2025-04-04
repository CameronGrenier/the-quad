/**
 * Controller for admin-related API endpoints.
 */
class AdminController {
  constructor(env, corsHeaders, backendService, auth) {
    this.env = env;
    this.corsHeaders = corsHeaders;
    this.backendService = backendService;
    this.auth = auth;
  }

  /**
   * Check if a user is in the STAFF table
   */
  async testStaff(request) {
    try {
      // Verify authentication
      const { isAuthenticated, userId } = this.auth.getAuthFromRequest(request);
      
      if (!isAuthenticated) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Authentication required" 
        }), { status: 401, headers: this.corsHeaders });
      }
      
      // Check if user is in the STAFF table
      const staffRecord = await this.backendService.queryFirst(
        "SELECT * FROM STAFF WHERE userID = ?", 
        [userId]
      );
      
      // Return result, including the record for debugging if found
      return new Response(JSON.stringify({ 
        success: true,
        userId: userId,
        isInStaffTable: !!staffRecord,
        staffRecord: staffRecord || null,
        message: "This is a debug route"
      }), { headers: this.corsHeaders });
    } catch (error) {
      console.error("Staff check error:", error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), { status: 500, headers: this.corsHeaders });
    }
  }

  /**
   * Get all pending official status requests
   */
  async getPendingRequests(request) {
    try {
      // Verify authentication
      const { isAuthenticated, userId } = this.auth.getAuthFromRequest(request);
      
      if (!isAuthenticated) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Authentication required" 
        }), { status: 401, headers: this.corsHeaders });
      }
      
      // Check if user is staff
      const isStaff = await this.backendService.queryFirst(
        "SELECT 1 FROM STAFF WHERE userID = ?", 
        [userId]
      );
      
      if (!isStaff) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Staff access required" 
        }), { status: 403, headers: this.corsHeaders });
      }
  
      // Get pending organization requests
      const pendingOrgs = await this.backendService.query(
        `SELECT o.* FROM ORGANIZATION o
         JOIN OFFICIAL_PENDING op ON o.orgID = op.orgID
         WHERE op.orgID IS NOT NULL`,
        []
      );
  
      // Get pending event requests
      const pendingEvents = await this.backendService.query(
        `SELECT e.* FROM EVENT e
         JOIN OFFICIAL_PENDING op ON e.eventID = op.eventID
         WHERE op.eventID IS NOT NULL`,
        []
      );
  
      return new Response(JSON.stringify({
        success: true,
        pendingOrganizations: pendingOrgs.results || [],
        pendingEvents: pendingEvents.results || []
      }), { headers: this.corsHeaders });
    } catch (error) {
      console.error("Admin pending-requests error:", error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), { status: 500, headers: this.corsHeaders });
    }
  }

  /**
   * Get counts of pending organizations and events
   */
  async getPendingCounts(request) {
    try {
      // Verify authentication
      const { isAuthenticated, userId } = this.auth.getAuthFromRequest(request);
      
      if (!isAuthenticated) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Authentication required" 
        }), { status: 401, headers: this.corsHeaders });
      }
      
      // Check if user is staff
      const isStaff = await this.backendService.queryFirst(
        "SELECT 1 FROM STAFF WHERE userID = ?", 
        [userId]
      );
      
      if (!isStaff) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Staff access required" 
        }), { status: 403, headers: this.corsHeaders });
      }
  
      // Get count of pending organizations
      const orgCount = await this.backendService.queryFirst(
        "SELECT COUNT(*) as count FROM OFFICIAL_PENDING WHERE orgID IS NOT NULL",
        []
      );
  
      // Get count of pending events
      const eventCount = await this.backendService.queryFirst(
        "SELECT COUNT(*) as count FROM OFFICIAL_PENDING WHERE eventID IS NOT NULL",
        []
      );
  
      return new Response(JSON.stringify({
        success: true,
        orgCount: orgCount?.count || 0,
        eventCount: eventCount?.count || 0
      }), { headers: this.corsHeaders });
    } catch (error) {
      console.error("Admin pending-counts error:", error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), { status: 500, headers: this.corsHeaders });
    }
  }

  /**
   * Get detailed information about an organization for approval
   */
  async getOrganizationDetails(request, orgId) {
    try {
      // Verify authentication
      const { isAuthenticated, userId } = this.auth.getAuthFromRequest(request);
      
      if (!isAuthenticated) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Authentication required" 
        }), { status: 401, headers: this.corsHeaders });
      }
      
      // Check if user is staff
      const isStaff = await this.backendService.queryFirst(
        "SELECT 1 FROM STAFF WHERE userID = ?", 
        [userId]
      );
      
      if (!isStaff) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Staff access required" 
        }), { status: 403, headers: this.corsHeaders });
      }
      
      // First get the organization details
      const organization = await this.backendService.queryFirst(
        "SELECT * FROM ORGANIZATION WHERE orgID = ?",
        [orgId]
      );
      
      if (!organization) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Organization not found" 
        }), { status: 404, headers: this.corsHeaders });
      }
      
      // Get organization admins - just get the IDs without joining
      const admins = await this.backendService.query(
        "SELECT userID FROM ORG_ADMIN WHERE orgID = ?",
        [orgId]
      );
      
      // Get member count
      const memberCount = await this.backendService.queryFirst(
        "SELECT COUNT(*) as count FROM ORG_MEMBER WHERE orgID = ?",
        [orgId]
      );
      
      // Get organization's events
      const events = await this.backendService.query(
        "SELECT * FROM EVENT WHERE organizationID = ?",
        [orgId]
      );
      
      // Calculate total RSVPs for all organization's events
      let totalRSVPs = 0;
      
      if (events.results && events.results.length > 0) {
        // Get event IDs
        const eventIds = events.results.map(event => event.eventID);
        
        if (eventIds.length > 0) {
          try {
            // Just count all RSVPs without filtering by status
            const placeholders = eventIds.map(() => '?').join(',');
            const rsvpCount = await this.backendService.queryFirst(
              `SELECT COUNT(*) as count 
               FROM EVENT_RSVP 
               WHERE eventID IN (${placeholders})`,
              eventIds
            );
            
            totalRSVPs = rsvpCount ? rsvpCount.count : 0;
          } catch (error) {
            console.error("Error counting RSVPs:", error);
            // Continue with totalRSVPs = 0
          }
        }
      }
      
      return new Response(JSON.stringify({
        success: true,
        organization,
        admins: admins.results || [],
        memberCount: memberCount ? memberCount.count : 0,
        events: events.results || [],
        eventsCount: events.results ? events.results.length : 0,
        totalRSVPs
      }), { headers: this.corsHeaders });
    } catch (error) {
      console.error("Org details error:", error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), { status: 500, headers: this.corsHeaders });
    }
  }

  /**
   * Get detailed information about an event for approval
   */
  async getEventDetails(request, eventId) {
    try {
      // Verify authentication
      const { isAuthenticated, userId } = this.auth.getAuthFromRequest(request);
      
      if (!isAuthenticated) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Authentication required" 
        }), { status: 401, headers: this.corsHeaders });
      }
      
      // Check if user is staff
      const isStaff = await this.backendService.queryFirst(
        "SELECT 1 FROM STAFF WHERE userID = ?", 
        [userId]
      );
      
      if (!isStaff) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Staff access required" 
        }), { status: 403, headers: this.corsHeaders });
      }
      
      // Get event details
      const event = await this.backendService.queryFirst(
        "SELECT * FROM EVENT WHERE eventID = ?",
        [eventId]
      );
      
      if (!event) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Event not found" 
        }), { status: 404, headers: this.corsHeaders });
      }
      
      // Get event's organization
      let organization = null;
      if (event.organizationID) {
        organization = await this.backendService.queryFirst(
          "SELECT * FROM ORGANIZATION WHERE orgID = ?",
          [event.organizationID]
        );
      }
      
      // Get event admins - just the IDs without joining
      const admins = await this.backendService.query(
        "SELECT userID FROM EVENT_ADMIN WHERE eventID = ?",
        [eventId]
      );
      
      // Get RSVP statistics
      const rsvpStats = {
        attending: 0,
        maybe: 0,
        declined: 0
      };
      
      try {
        // Get attending count
        const attendingCount = await this.backendService.queryFirst(
          "SELECT COUNT(*) as count FROM EVENT_RSVP WHERE eventID = ? AND status = 'attending'",
          [eventId]
        );
        
        if (attendingCount) {
          rsvpStats.attending = attendingCount.count;
        }
        
        // Get maybe count
        const maybeCount = await this.backendService.queryFirst(
          "SELECT COUNT(*) as count FROM EVENT_RSVP WHERE eventID = ? AND status = 'maybe'",
          [eventId]
        );
        
        if (maybeCount) {
          rsvpStats.maybe = maybeCount.count;
        }
        
        // Get declined count
        const declinedCount = await this.backendService.queryFirst(
          "SELECT COUNT(*) as count FROM EVENT_RSVP WHERE eventID = ? AND status = 'declined'",
          [eventId]
        );
        
        if (declinedCount) {
          rsvpStats.declined = declinedCount.count;
        }
      } catch (error) {
        console.error("Error fetching RSVP stats:", error);
        // Continue with default rsvpStats values
      }
      
      return new Response(JSON.stringify({
        success: true,
        event,
        organization,
        admins: admins.results || [],
        rsvpStats
      }), { headers: this.corsHeaders });
    } catch (error) {
      console.error("Event details error:", error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), { status: 500, headers: this.corsHeaders });
    }
  }

  /**
   * Approve an official status request
   */
  async approveOfficial(request) {
    try {
      // Verify authentication
      const { isAuthenticated, userId } = this.auth.getAuthFromRequest(request);
      
      if (!isAuthenticated) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Authentication required" 
        }), { status: 401, headers: this.corsHeaders });
      }
      
      // Check if user is staff
      const isStaff = await this.backendService.queryFirst(
        "SELECT 1 FROM STAFF WHERE userID = ?", 
        [userId]
      );
      
      if (!isStaff) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Staff access required" 
        }), { status: 403, headers: this.corsHeaders });
      }
      
      // Parse request body
      const body = await request.json();
      const { orgID, eventID } = body;
      
      // Ensure at least one ID is provided
      if (!orgID && !eventID) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Either orgID or eventID must be provided" 
        }), { status: 400, headers: this.corsHeaders });
      }
      
      // Check if the entry exists in OFFICIAL_PENDING
      let pendingEntry;
      
      if (orgID) {
        pendingEntry = await this.backendService.queryFirst(
          "SELECT * FROM OFFICIAL_PENDING WHERE orgID = ?",
          [orgID]
        );
      } else {
        pendingEntry = await this.backendService.queryFirst(
          "SELECT * FROM OFFICIAL_PENDING WHERE eventID = ?",
          [eventID]
        );
      }
      
      if (!pendingEntry) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "No pending official status request found" 
        }), { status: 404, headers: this.corsHeaders });
      }
      
      // Move from OFFICIAL_PENDING to OFFICIAL
      await this.backendService.query(
        "INSERT INTO OFFICIAL (orgID, eventID) VALUES (?, ?)",
        [orgID || null, eventID || null]
      );
      
      // Remove from OFFICIAL_PENDING
      if (orgID) {
        await this.backendService.query(
          "DELETE FROM OFFICIAL_PENDING WHERE orgID = ?",
          [orgID]
        );
      } else {
        await this.backendService.query(
          "DELETE FROM OFFICIAL_PENDING WHERE eventID = ?",
          [eventID]
        );
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Official status approved" 
      }), { headers: this.corsHeaders });
    } catch (error) {
      console.error("Approve official error:", error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), { status: 500, headers: this.corsHeaders });
    }
  }

  /**
   * Reject an official status request
   */
  async rejectOfficial(request) {
    try {
      // Verify authentication
      const { isAuthenticated, userId } = this.auth.getAuthFromRequest(request);
      
      if (!isAuthenticated) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Authentication required" 
        }), { status: 401, headers: this.corsHeaders });
      }
      
      // Check if user is staff
      const isStaff = await this.backendService.queryFirst(
        "SELECT 1 FROM STAFF WHERE userID = ?", 
        [userId]
      );
      
      if (!isStaff) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Staff access required" 
        }), { status: 403, headers: this.corsHeaders });
      }
      
      // Parse request body
      const body = await request.json();
      const { orgID, eventID } = body;
      
      // Ensure at least one ID is provided
      if (!orgID && !eventID) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Either orgID or eventID must be provided" 
        }), { status: 400, headers: this.corsHeaders });
      }
      
      // Check if the entry exists in OFFICIAL_PENDING
      let pendingEntry;
      
      if (orgID) {
        pendingEntry = await this.backendService.queryFirst(
          "SELECT * FROM OFFICIAL_PENDING WHERE orgID = ?",
          [orgID]
        );
      } else {
        pendingEntry = await this.backendService.queryFirst(
          "SELECT * FROM OFFICIAL_PENDING WHERE eventID = ?",
          [eventID]
        );
      }
      
      if (!pendingEntry) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "No pending official status request found" 
        }), { status: 404, headers: this.corsHeaders });
      }
      
      // Remove from OFFICIAL_PENDING
      if (orgID) {
        await this.backendService.query(
          "DELETE FROM OFFICIAL_PENDING WHERE orgID = ?",
          [orgID]
        );
      } else {
        await this.backendService.query(
          "DELETE FROM OFFICIAL_PENDING WHERE eventID = ?",
          [eventID]
        );
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Official status request rejected" 
      }), { headers: this.corsHeaders });
    } catch (error) {
      console.error("Reject official error:", error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), { status: 500, headers: this.corsHeaders });
    }
  }

  /**
   * Check if an organization or event is pending official status
   */
  async checkOfficialPending(request) {
    try {
      const url = new URL(request.url);
      const orgId = url.searchParams.get('orgID');
      const eventId = url.searchParams.get('eventID');
      
      if (!orgId && !eventId) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Either orgID or eventID parameter is required" 
        }), { status: 400, headers: this.corsHeaders });
      }
      
      let isPending = false;
      
      if (orgId) {
        isPending = await this.backendService.queryFirst(
          "SELECT 1 FROM OFFICIAL_PENDING WHERE orgID = ?",
          [orgId]
        );
      } else if (eventId) {
        isPending = await this.backendService.queryFirst(
          "SELECT 1 FROM OFFICIAL_PENDING WHERE eventID = ?",
          [eventId]
        );
      }
      
      return new Response(JSON.stringify({
        success: true,
        isPending: !!isPending
      }), { headers: this.corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), { status: 500, headers: this.corsHeaders });
    }
  }

  /**
   * Check if an organization or event has official status
   */
  async checkOfficial(request) {
    try {
      const url = new URL(request.url);
      const orgId = url.searchParams.get('orgID');
      const eventId = url.searchParams.get('eventID');
      
      if (!orgId && !eventId) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Either orgID or eventID parameter is required" 
        }), { status: 400, headers: this.corsHeaders });
      }
      
      let isOfficial = false;
      
      if (orgId) {
        isOfficial = await this.backendService.queryFirst(
          "SELECT 1 FROM OFFICIAL WHERE orgID = ?",
          [orgId]
        );
      } else if (eventId) {
        isOfficial = await this.backendService.queryFirst(
          "SELECT 1 FROM OFFICIAL WHERE eventID = ?",
          [eventId]
        );
      }
      
      return new Response(JSON.stringify({
        success: true,
        isOfficial: !!isOfficial
      }), { headers: this.corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), { status: 500, headers: this.corsHeaders });
    }
  }

  /**
   * Submit an organization or event for official status
   */
  async submitForOfficial(request) {
    try {
      // Verify authentication
      const { isAuthenticated, userId } = this.auth.getAuthFromRequest(request);
      
      if (!isAuthenticated) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Authentication required" 
        }), { status: 401, headers: this.corsHeaders });
      }
      
      // Parse request body
      const body = await request.json();
      const { orgID, eventID } = body;
      
      // Ensure at least one ID is provided
      if (!orgID && !eventID) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Either orgID or eventID must be provided" 
        }), { status: 400, headers: this.corsHeaders });
      }
      
      // Check if user is an admin of the organization or event
      let isAdmin = false;
      
      if (orgID) {
        isAdmin = await this.backendService.queryFirst(
          "SELECT 1 FROM ORG_ADMIN WHERE orgID = ? AND userID = ?",
          [orgID, userId]
        );
      } else if (eventID) {
        isAdmin = await this.backendService.queryFirst(
          "SELECT 1 FROM EVENT_ADMIN WHERE eventID = ? AND userID = ?",
          [eventID, userId]
        );
      }
      
      if (!isAdmin) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Only admins can submit for official status" 
        }), { status: 403, headers: this.corsHeaders });
      }
      
      // Check if the organization or event has thumbnail and banner
      let item;
      
      if (orgID) {
        item = await this.backendService.queryFirst(
          "SELECT thumbnail, banner FROM ORGANIZATION WHERE orgID = ?",
          [orgID]
        );
        
        if (!item || !item.thumbnail || !item.banner) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Organizations must have both thumbnail and banner to be submitted for official status" 
          }), { status: 400, headers: this.corsHeaders });
        }
      } else if (eventID) {
        item = await this.backendService.queryFirst(
          "SELECT thumbnail, banner FROM EVENT WHERE eventID = ?",
          [eventID]
        );
        
        if (!item || !item.thumbnail || !item.banner) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Events must have both thumbnail and banner to be submitted for official status" 
          }), { status: 400, headers: this.corsHeaders });
        }
      }
      
      // Check if already in OFFICIAL_PENDING
      let alreadyPending = false;
      
      if (orgID) {
        alreadyPending = await this.backendService.queryFirst(
          "SELECT 1 FROM OFFICIAL_PENDING WHERE orgID = ?",
          [orgID]
        );
      } else if (eventID) {
        alreadyPending = await this.backendService.queryFirst(
          "SELECT 1 FROM OFFICIAL_PENDING WHERE eventID = ?",
          [eventID]
        );
      }
      
      if (alreadyPending) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Already pending official approval" 
        }), { status: 400, headers: this.corsHeaders });
      }
      
      // Check if already in OFFICIAL
      let alreadyOfficial = false;
      
      if (orgID) {
        alreadyOfficial = await this.backendService.queryFirst(
          "SELECT 1 FROM OFFICIAL WHERE orgID = ?",
          [orgID]
        );
      } else if (eventID) {
        alreadyOfficial = await this.backendService.queryFirst(
          "SELECT 1 FROM OFFICIAL WHERE eventID = ?",
          [eventID]
        );
      }
      
      if (alreadyOfficial) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Already has official status" 
        }), { status: 400, headers: this.corsHeaders });
      }
      
      // Add to OFFICIAL_PENDING
      await this.backendService.query(
        "INSERT INTO OFFICIAL_PENDING (orgID, eventID) VALUES (?, ?)",
        [orgID || null, eventID || null]
      );
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Successfully submitted for official status" 
      }), { headers: this.corsHeaders });
    } catch (error) {
      console.error("Submit for official status error:", error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), { status: 500, headers: this.corsHeaders });
    }
  }
}

export default AdminController;