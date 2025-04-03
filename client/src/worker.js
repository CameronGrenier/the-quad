/**
 * The Quad - University Event Planner - Cloudflare Worker (Object Oriented)
 *
 * Domain classes represent the data model while controller classes encapsulate
 * the API endpoint logic.
 */

import BackendService from './services/BackendService.js';
import Auth from './utils/auth.js';
import formDataUtil from './utils/formData.js';
import AccountController from './controllers/AccountController.js';
import OrganizationController from './controllers/OrganizationController.js';
import EventController from './controllers/EventController.js';

/* ==================== MAIN WORKER FUNCTION ==================== */
export default {
  async fetch(request, env, ctx) {
    const backendService = new BackendService(env);
    const auth = new Auth();
    
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "application/json"
    };
    
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    
    const url = new URL(request.url);
    const path = url.pathname;

    const accountCtrl = new AccountController(env, corsHeaders, backendService, auth);
    const orgCtrl = new OrganizationController(env, corsHeaders, backendService, auth);
    const eventCtrl = new EventController(env, corsHeaders, backendService, auth);

    try {
      // Routes remain the same - no changes needed here
      if (path === "/api/signup" && request.method === "POST") {
        return await accountCtrl.createAccount(request);
      }
      if (path === "/api/login" && request.method === "POST") {
        return await accountCtrl.login(request);
      }
      if (path === "/api/user-profile" && request.method === "GET") {
        return await accountCtrl.getUserProfile(request);
      }
      if (path === "/api/update-profile" && request.method === "POST") {
        return await accountCtrl.updateProfile(request);
      }
      if (path === "/api/register-organization" && request.method === "POST") {
        return await orgCtrl.registerOrganization(request);
      }
      if (path === "/api/user-organizations" && request.method === "GET") {
        return await orgCtrl.getUserOrganizations(request);
      }
      if (path === "/api/organizations" && request.method === "GET") {
        return await orgCtrl.getAllOrganizations(request);
      }
      if (path.match(/^\/api\/organizations\/\d+$/) && request.method === "GET") {
        const orgId = parseInt(path.split('/').pop());
        return await orgCtrl.getOrganization(orgId);
      }
      if (path.match(/^\/api\/organizations\/\d+$/) && request.method === "PUT") {
        const orgId = parseInt(path.split('/').pop());
        return await orgCtrl.updateOrganization(orgId, request);
      }

      if (path.match(/^\/api\/organizations\/\d+$/) && request.method === "DELETE") {
        const orgId = parseInt(path.split('/').pop());
        return await orgCtrl.deleteOrganization(orgId, request);
      }

      if (path.match(/^\/api\/organizations\/\d+\/events$/)) {
        const parts = path.split('/');
        const orgId = parseInt(parts[3]);
        return await orgCtrl.getOrganizationEvents(orgId);
      }
      if (path.match(/^\/api\/organizations\/\d+\/members$/) && request.method === "GET") {
        const orgId = parseInt(path.split('/').pop());
        return await orgCtrl.getOrganizationMembers(orgId, request);
      }
      if (path.match(/^\/api\/organizations\/\d+\/members\/\d+$/) && request.method === "DELETE") {
        const parts = path.split('/');
        const orgId = parseInt(parts[3]);
        const memberId = parseInt(parts[5]);
        return await orgCtrl.removeMember(orgId, memberId, request);
      }
      if (path.match(/^\/api\/organizations\/\d+\/admins$/) && request.method === "POST") {
        const orgId = parseInt(path.split('/').pop());
        return await orgCtrl.addAdmin(orgId, request);
      }
      if (path.match(/^\/api\/organizations\/\d+\/admins\/\d+$/) && request.method === "DELETE") {
        const parts = path.split('/');
        const orgId = parseInt(parts[3]);
        const adminId = parseInt(parts[5]);
        return await orgCtrl.removeAdmin(orgId, adminId, request);
      }
      if (path === "/api/user-member-organizations" && request.method === "GET") {
        return await orgCtrl.getUserMemberOrganizations(request);
      }
      
      // Add these new routes for events
      if (path === "/api/events" && request.method === "GET") {
        return await eventCtrl.getAllEvents(request);
      }
      
      if (path.match(/^\/api\/events\/\d+$/) && request.method === "GET") {
        const eventId = parseInt(path.split('/').pop());
        return await eventCtrl.getEventById(eventId);
      }
      
      // RSVP route
      if (path.match(/^\/api\/events\/\d+\/rsvp$/) && request.method === "POST") {
        const eventId = parseInt(path.split('/')[3]);
        return await eventCtrl.handleEventRSVP(eventId, request);
      }
      
      // RSVP status route
      if (path.match(/^\/api\/events\/\d+\/rsvp-status$/) && request.method === "GET") {
        const eventId = parseInt(path.split('/')[3]);
        return await eventCtrl.getRSVPStatus(eventId, request);
      }
      
      if (path === "/api/register-event" && request.method === "POST") {
        return await eventCtrl.registerEvent(request);
      }
      
      // Add this new route for user events
      if (path === "/api/user/events" && request.method === "GET") {
        return await eventCtrl.getUserEvents(request);
      }
      
      if (path === "/api/check-membership" && request.method === "GET") {
        return await orgCtrl.checkMembership(request);
      }

      if (path === "/api/organization-membership" && request.method === "POST") {
        return await orgCtrl.handleMembership(request);
      }
      
      if (path.startsWith("/images/")) {
        const imagePath = path.substring(8);
        return await backendService.serveImage(imagePath, corsHeaders);
      }

      // Add these routes to handle admin requests for pending items

      if (path === "/api/admin/pending-requests" && request.method === "GET") {
        try {
          // Verify authentication
          const { isAuthenticated, userId } = auth.getAuthFromRequest(request);
          
          if (!isAuthenticated) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "Authentication required" 
            }), { status: 401, headers: corsHeaders });
          }
          
          // Check if user is staff
          const isStaff = await backendService.queryFirst(
            "SELECT 1 FROM STAFF WHERE userID = ?", 
            [userId]
          );
          
          if (!isStaff) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "Staff access required" 
            }), { status: 403, headers: corsHeaders });
          }
      
          // Get pending organization requests
          const pendingOrgs = await backendService.query(
            `SELECT o.* FROM ORGANIZATION o
             JOIN OFFICIAL_PENDING op ON o.orgID = op.orgID
             WHERE op.orgID IS NOT NULL`,
            []
          );
      
          // Get pending event requests
          const pendingEvents = await backendService.query(
            `SELECT e.* FROM EVENT e
             JOIN OFFICIAL_PENDING op ON e.eventID = op.eventID
             WHERE op.eventID IS NOT NULL`,
            []
          );
      
          return new Response(JSON.stringify({
            success: true,
            pendingOrganizations: pendingOrgs.results || [],
            pendingEvents: pendingEvents.results || []
          }), { headers: corsHeaders });
        } catch (error) {
          console.error("Admin pending-requests error:", error);
          return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
          }), { status: 500, headers: corsHeaders });
        }
      }
      
      if (path === "/api/admin/pending-counts" && request.method === "GET") {
        try {
          // Verify authentication
          const { isAuthenticated, userId } = auth.getAuthFromRequest(request);
          
          if (!isAuthenticated) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "Authentication required" 
            }), { status: 401, headers: corsHeaders });
          }
          
          // Check if user is staff
          const isStaff = await backendService.queryFirst(
            "SELECT 1 FROM STAFF WHERE userID = ?", 
            [userId]
          );
          
          if (!isStaff) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "Staff access required" 
            }), { status: 403, headers: corsHeaders });
          }
      
          // Get count of pending organizations
          const orgCount = await backendService.queryFirst(
            "SELECT COUNT(*) as count FROM OFFICIAL_PENDING WHERE orgID IS NOT NULL",
            []
          );
      
          // Get count of pending events
          const eventCount = await backendService.queryFirst(
            "SELECT COUNT(*) as count FROM OFFICIAL_PENDING WHERE eventID IS NOT NULL",
            []
          );
      
          return new Response(JSON.stringify({
            success: true,
            orgCount: orgCount?.count || 0,
            eventCount: eventCount?.count || 0
          }), { headers: corsHeaders });
        } catch (error) {
          console.error("Admin pending-counts error:", error);
          return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
          }), { status: 500, headers: corsHeaders });
        }
      }
      
      //handle submitting items for official status

      if (path === "/api/submit-for-official" && request.method === "POST") {
        try {
          // Verify authentication
          const { isAuthenticated, userId } = auth.getAuthFromRequest(request);
          
          if (!isAuthenticated) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "Authentication required" 
            }), { status: 401, headers: corsHeaders });
          }
          
          // Parse request body
          const body = await request.json();
          const { orgID, eventID } = body;
          
          // Ensure at least one ID is provided
          if (!orgID && !eventID) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "Either orgID or eventID must be provided" 
            }), { status: 400, headers: corsHeaders });
          }
          
          // Check if user is an admin of the organization or event
          let isAdmin = false;
          
          if (orgID) {
            isAdmin = await backendService.queryFirst(
              "SELECT 1 FROM ORG_ADMIN WHERE orgID = ? AND userID = ?",
              [orgID, userId]
            );
          } else if (eventID) {
            isAdmin = await backendService.queryFirst(
              "SELECT 1 FROM EVENT_ADMIN WHERE eventID = ? AND userID = ?",
              [eventID, userId]
            );
          }
          
          if (!isAdmin) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "Only admins can submit for official status" 
            }), { status: 403, headers: corsHeaders });
          }
          
          // Check if the organization or event has thumbnail and banner
          let item;
          
          if (orgID) {
            item = await backendService.queryFirst(
              "SELECT thumbnail, banner FROM ORGANIZATION WHERE orgID = ?",
              [orgID]
            );
            
            if (!item || !item.thumbnail || !item.banner) {
              return new Response(JSON.stringify({ 
                success: false, 
                error: "Organizations must have both thumbnail and banner to be submitted for official status" 
              }), { status: 400, headers: corsHeaders });
            }
          } else if (eventID) {
            item = await backendService.queryFirst(
              "SELECT thumbnail, banner FROM EVENT WHERE eventID = ?",
              [eventID]
            );
            
            if (!item || !item.thumbnail || !item.banner) {
              return new Response(JSON.stringify({ 
                success: false, 
                error: "Events must have both thumbnail and banner to be submitted for official status" 
              }), { status: 400, headers: corsHeaders });
            }
          }
          
          // Check if already in OFFICIAL_PENDING
          let alreadyPending = false;
          
          if (orgID) {
            alreadyPending = await backendService.queryFirst(
              "SELECT 1 FROM OFFICIAL_PENDING WHERE orgID = ?",
              [orgID]
            );
          } else if (eventID) {
            alreadyPending = await backendService.queryFirst(
              "SELECT 1 FROM OFFICIAL_PENDING WHERE eventID = ?",
              [eventID]
            );
          }
          
          if (alreadyPending) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "Already pending official approval" 
            }), { status: 400, headers: corsHeaders });
          }
          
          // Check if already in OFFICIAL
          let alreadyOfficial = false;
          
          if (orgID) {
            alreadyOfficial = await backendService.queryFirst(
              "SELECT 1 FROM OFFICIAL WHERE orgID = ?",
              [orgID]
            );
          } else if (eventID) {
            alreadyOfficial = await backendService.queryFirst(
              "SELECT 1 FROM OFFICIAL WHERE eventID = ?",
              [eventID]
            );
          }
          
          if (alreadyOfficial) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "Already has official status" 
            }), { status: 400, headers: corsHeaders });
          }
          
          // Add to OFFICIAL_PENDING
          await backendService.query(
            "INSERT INTO OFFICIAL_PENDING (orgID, eventID) VALUES (?, ?)",
            [orgID || null, eventID || null]
          );
          
          return new Response(JSON.stringify({ 
            success: true, 
            message: "Successfully submitted for official status" 
          }), { headers: corsHeaders });
        } catch (error) {
          console.error("Submit for official status error:", error);
          return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
          }), { status: 500, headers: corsHeaders });
        }
      }
      
      // Add these routes to check official status

      if (path === "/api/admin/check-official-pending" && request.method === "GET") {
        try {
          const url = new URL(request.url);
          const orgId = url.searchParams.get('orgID');
          const eventId = url.searchParams.get('eventID');
          
          if (!orgId && !eventId) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "Either orgID or eventID parameter is required" 
            }), { status: 400, headers: corsHeaders });
          }
          
          let isPending = false;
          
          if (orgId) {
            isPending = await backendService.queryFirst(
              "SELECT 1 FROM OFFICIAL_PENDING WHERE orgID = ?",
              [orgId]
            );
          } else if (eventId) {
            isPending = await backendService.queryFirst(
              "SELECT 1 FROM OFFICIAL_PENDING WHERE eventID = ?",
              [eventId]
            );
          }
          
          return new Response(JSON.stringify({
            success: true,
            isPending: !!isPending
          }), { headers: corsHeaders });
        } catch (error) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
          }), { status: 500, headers: corsHeaders });
        }
      }
      
      if (path === "/api/admin/check-official" && request.method === "GET") {
        try {
          const url = new URL(request.url);
          const orgId = url.searchParams.get('orgID');
          const eventId = url.searchParams.get('eventID');
          
          if (!orgId && !eventId) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "Either orgID or eventID parameter is required" 
            }), { status: 400, headers: corsHeaders });
          }
          
          let isOfficial = false;
          
          if (orgId) {
            isOfficial = await backendService.queryFirst(
              "SELECT 1 FROM OFFICIAL WHERE orgID = ?",
              [orgId]
            );
          } else if (eventId) {
            isOfficial = await backendService.queryFirst(
              "SELECT 1 FROM OFFICIAL WHERE eventID = ?",
              [eventId]
            );
          }
          
          return new Response(JSON.stringify({
            success: true,
            isOfficial: !!isOfficial
          }), { headers: corsHeaders });
        } catch (error) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
          }), { status: 500, headers: corsHeaders });
        }
      }

      // Add these endpoints for the admin dashboard

      // Test if a user is staff
      if (path === "/api/admin/test-staff" && request.method === "GET") {
        try {
          // Verify authentication
          const { isAuthenticated, userId } = auth.getAuthFromRequest(request);
          
          if (!isAuthenticated) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "Authentication required" 
            }), { status: 401, headers: corsHeaders });
          }
          
          // Check if user is in the STAFF table
          const staffRecord = await backendService.queryFirst(
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
          }), { headers: corsHeaders });
        } catch (error) {
          console.error("Staff check error:", error);
          return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
          }), { status: 500, headers: corsHeaders });
        }
      }

      // Get detailed organization information for admin review
      if (path.match(/\/api\/admin\/org-details\/(\d+)/) && request.method === "GET") {
        try {
          // Verify authentication
          const { isAuthenticated, userId } = auth.getAuthFromRequest(request);
          
          if (!isAuthenticated) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "Authentication required" 
            }), { status: 401, headers: corsHeaders });
          }
          
          // Check if user is staff
          const isStaff = await backendService.queryFirst(
            "SELECT 1 FROM STAFF WHERE userID = ?", 
            [userId]
          );
          
          if (!isStaff) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "Staff access required" 
            }), { status: 403, headers: corsHeaders });
          }
          
          // Extract orgID from URL
          const orgId = path.match(/\/api\/admin\/org-details\/(\d+)/)[1];
          
          // Get organization details
          const organization = await backendService.queryFirst(
            "SELECT * FROM ORGANIZATION WHERE orgID = ?",
            [orgId]
          );
          
          if (!organization) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "Organization not found" 
            }), { status: 404, headers: corsHeaders });
          }
          
          // Get organization admins
          const admins = await backendService.query(
            `SELECT u.userID, u.email 
             FROM ORG_ADMIN oa 
             JOIN USER u ON oa.userID = u.userID 
             WHERE oa.orgID = ?`,
            [orgId]
          );
          
          // Get member count
          const memberCount = await backendService.queryFirst(
            "SELECT COUNT(*) as count FROM ORG_MEMBER WHERE orgID = ?",
            [orgId]
          );
          
          // Get organization's events
          const events = await backendService.query(
            "SELECT * FROM EVENT WHERE organizationID = ?",
            [orgId]
          );
          
          // Calculate total RSVPs for all organization's events
          let totalRSVPs = 0;
          
          if (events.results && events.results.length > 0) {
            // Get event IDs
            const eventIds = events.results.map(event => event.eventID);
            
            // Build the IN clause for the SQL query
            const placeholders = eventIds.map(() => '?').join(',');
            
            // Get all attending RSVPs
            const rsvpCount = await backendService.queryFirst(
              `SELECT COUNT(*) as count 
               FROM EVENT_RSVP 
               WHERE eventID IN (${placeholders}) AND status = 'attending'`,
              eventIds
            );
            
            totalRSVPs = rsvpCount ? rsvpCount.count : 0;
          }
          
          return new Response(JSON.stringify({
            success: true,
            organization,
            admins: admins.results || [],
            memberCount: memberCount ? memberCount.count : 0,
            events: events.results || [],
            eventsCount: events.results ? events.results.length : 0,
            totalRSVPs
          }), { headers: corsHeaders });
        } catch (error) {
          console.error("Org details error:", error);
          return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
          }), { status: 500, headers: corsHeaders });
        }
      }

      // Get detailed event information for admin review
      if (path.match(/\/api\/admin\/event-details\/(\d+)/) && request.method === "GET") {
        try {
          // Verify authentication
          const { isAuthenticated, userId } = auth.getAuthFromRequest(request);
          
          if (!isAuthenticated) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "Authentication required" 
            }), { status: 401, headers: corsHeaders });
          }
          
          // Check if user is staff
          const isStaff = await backendService.queryFirst(
            "SELECT 1 FROM STAFF WHERE userID = ?", 
            [userId]
          );
          
          if (!isStaff) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "Staff access required" 
            }), { status: 403, headers: corsHeaders });
          }
          
          // Extract eventID from URL
          const eventId = path.match(/\/api\/admin\/event-details\/(\d+)/)[1];
          
          // Get event details
          const event = await backendService.queryFirst(
            "SELECT * FROM EVENT WHERE eventID = ?",
            [eventId]
          );
          
          if (!event) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "Event not found" 
            }), { status: 404, headers: corsHeaders });
          }
          
          // Get event's organization
          let organization = null;
          if (event.organizationID) {
            organization = await backendService.queryFirst(
              "SELECT * FROM ORGANIZATION WHERE orgID = ?",
              [event.organizationID]
            );
          }
          
          // Get event admins
          const admins = await backendService.query(
            `SELECT u.userID, u.email 
             FROM EVENT_ADMIN ea 
             JOIN USER u ON ea.userID = u.userID 
             WHERE ea.eventID = ?`,
            [eventId]
          );
          
          // Get RSVP statistics
          const rsvpStats = {
            attending: 0,
            maybe: 0,
            declined: 0
          };
          
          // Get attending count
          const attendingCount = await backendService.queryFirst(
            "SELECT COUNT(*) as count FROM EVENT_RSVP WHERE eventID = ? AND status = 'attending'",
            [eventId]
          );
          
          if (attendingCount) {
            rsvpStats.attending = attendingCount.count;
          }
          
          // Get maybe count
          const maybeCount = await backendService.queryFirst(
            "SELECT COUNT(*) as count FROM EVENT_RSVP WHERE eventID = ? AND status = 'maybe'",
            [eventId]
          );
          
          if (maybeCount) {
            rsvpStats.maybe = maybeCount.count;
          }
          
          // Get declined count
          const declinedCount = await backendService.queryFirst(
            "SELECT COUNT(*) as count FROM EVENT_RSVP WHERE eventID = ? AND status = 'declined'",
            [eventId]
          );
          
          if (declinedCount) {
            rsvpStats.declined = declinedCount.count;
          }
          
          return new Response(JSON.stringify({
            success: true,
            event,
            organization,
            admins: admins.results || [],
            rsvpStats
          }), { headers: corsHeaders });
        } catch (error) {
          console.error("Event details error:", error);
          return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
          }), { status: 500, headers: corsHeaders });
        }
      }

      // Approve an official status request
      if (path === "/api/admin/approve-official" && request.method === "POST") {
        try {
          // Verify authentication
          const { isAuthenticated, userId } = auth.getAuthFromRequest(request);
          
          if (!isAuthenticated) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "Authentication required" 
            }), { status: 401, headers: corsHeaders });
          }
          
          // Check if user is staff
          const isStaff = await backendService.queryFirst(
            "SELECT 1 FROM STAFF WHERE userID = ?", 
            [userId]
          );
          
          if (!isStaff) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "Staff access required" 
            }), { status: 403, headers: corsHeaders });
          }
          
          // Parse request body
          const body = await request.json();
          const { orgID, eventID } = body;
          
          // Ensure at least one ID is provided
          if (!orgID && !eventID) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "Either orgID or eventID must be provided" 
            }), { status: 400, headers: corsHeaders });
          }
          
          // Check if the entry exists in OFFICIAL_PENDING
          let pendingEntry;
          
          if (orgID) {
            pendingEntry = await backendService.queryFirst(
              "SELECT * FROM OFFICIAL_PENDING WHERE orgID = ?",
              [orgID]
            );
          } else {
            pendingEntry = await backendService.queryFirst(
              "SELECT * FROM OFFICIAL_PENDING WHERE eventID = ?",
              [eventID]
            );
          }
          
          if (!pendingEntry) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "No pending official status request found" 
            }), { status: 404, headers: corsHeaders });
          }
          
          // Move from OFFICIAL_PENDING to OFFICIAL
          await backendService.query(
            "INSERT INTO OFFICIAL (orgID, eventID) VALUES (?, ?)",
            [orgID || null, eventID || null]
          );
          
          // Remove from OFFICIAL_PENDING
          if (orgID) {
            await backendService.query(
              "DELETE FROM OFFICIAL_PENDING WHERE orgID = ?",
              [orgID]
            );
          } else {
            await backendService.query(
              "DELETE FROM OFFICIAL_PENDING WHERE eventID = ?",
              [eventID]
            );
          }
          
          return new Response(JSON.stringify({ 
            success: true, 
            message: "Official status approved" 
          }), { headers: corsHeaders });
        } catch (error) {
          console.error("Approve official error:", error);
          return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
          }), { status: 500, headers: corsHeaders });
        }
      }

      // Reject an official status request
      if (path === "/api/admin/reject-official" && request.method === "POST") {
        try {
          // Verify authentication
          const { isAuthenticated, userId } = auth.getAuthFromRequest(request);
          
          if (!isAuthenticated) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "Authentication required" 
            }), { status: 401, headers: corsHeaders });
          }
          
          // Check if user is staff
          const isStaff = await backendService.queryFirst(
            "SELECT 1 FROM STAFF WHERE userID = ?", 
            [userId]
          );
          
          if (!isStaff) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "Staff access required" 
            }), { status: 403, headers: corsHeaders });
          }
          
          // Parse request body
          const body = await request.json();
          const { orgID, eventID } = body;
          
          // Ensure at least one ID is provided
          if (!orgID && !eventID) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "Either orgID or eventID must be provided" 
            }), { status: 400, headers: corsHeaders });
          }
          
          // Check if the entry exists in OFFICIAL_PENDING
          let pendingEntry;
          
          if (orgID) {
            pendingEntry = await backendService.queryFirst(
              "SELECT * FROM OFFICIAL_PENDING WHERE orgID = ?",
              [orgID]
            );
          } else {
            pendingEntry = await backendService.queryFirst(
              "SELECT * FROM OFFICIAL_PENDING WHERE eventID = ?",
              [eventID]
            );
          }
          
          if (!pendingEntry) {
            return new Response(JSON.stringify({ 
              success: false, 
              error: "No pending official status request found" 
            }), { status: 404, headers: corsHeaders });
          }
          
          // Remove from OFFICIAL_PENDING
          if (orgID) {
            await backendService.query(
              "DELETE FROM OFFICIAL_PENDING WHERE orgID = ?",
              [orgID]
            );
          } else {
            await backendService.query(
              "DELETE FROM OFFICIAL_PENDING WHERE eventID = ?",
              [eventID]
            );
          }
          
          return new Response(JSON.stringify({ 
            success: true, 
            message: "Official status request rejected" 
          }), { headers: corsHeaders });
        } catch (error) {
          console.error("Reject official error:", error);
          return new Response(JSON.stringify({ 
            success: false, 
            error: error.message 
          }), { status: 500, headers: corsHeaders });
        }
      }
      
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ error: "Server error", message: error.message }),
        { status: 500, headers: corsHeaders });
    }
  }
};