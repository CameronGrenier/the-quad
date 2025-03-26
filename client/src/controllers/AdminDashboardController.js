import { verifyJWT } from '../utils/auth.js';

export class AdminDashboard {
  constructor(env, corsHeaders) {
    this.env = env;
    this.corsHeaders = corsHeaders;
  }
  
  async displayPendingSubmissions(request) {
    try {
      // Check if user is admin
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '');
      if (!token) {
        return new Response(JSON.stringify({ success: false, error: "Authentication token required" }),
          { status: 401, headers: this.corsHeaders });
      }
      
      // In a production app, we would check if the user is an admin
      // For now, we'll just return all pending submissions
      
      // Get pending organization submissions
      const pendingOrgs = await this.env.D1_DB.prepare(`
        SELECT o.*, ps.submissionID
        FROM PENDING_SUBMISSION ps
        JOIN ORGANIZATION o ON ps.orgID = o.orgID
        WHERE ps.orgID IS NOT NULL
      `).all();
      
      // Get pending event submissions
      const pendingEvents = await this.env.D1_DB.prepare(`
        SELECT e.*, ps.submissionID
        FROM PENDING_SUBMISSION ps
        JOIN EVENT e ON ps.eventID = e.eventID
        WHERE ps.eventID IS NOT NULL
      `).all();
      
      return new Response(JSON.stringify({
        success: true,
        pendingOrganizations: pendingOrgs.results || [],
        pendingEvents: pendingEvents.results || []
      }), { headers: this.corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: this.corsHeaders });
    }
  }
  
  async reviewSubmission(itemID) {
    try {
      const submission = await this.env.D1_DB.prepare(
        "SELECT * FROM PENDING_SUBMISSION WHERE submissionID = ?"
      ).bind(itemID).first();
      
      if (!submission) {
        return new Response(JSON.stringify({
          success: false,
          error: "Submission not found"
        }), { status: 404, headers: this.corsHeaders });
      }
      
      let details = {};
      if (submission.orgID) {
        const org = await this.env.D1_DB.prepare(
          "SELECT * FROM ORGANIZATION WHERE orgID = ?"
        ).bind(submission.orgID).first();
        details = { type: 'organization', ...org };
      } else if (submission.eventID) {
        const event = await this.env.D1_DB.prepare(
          "SELECT * FROM EVENT WHERE eventID = ?"
        ).bind(submission.eventID).first();
        details = { type: 'event', ...event };
      }
      
      return new Response(JSON.stringify({
        success: true,
        submission: {
          ...submission,
          details
        }
      }), { headers: this.corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: this.corsHeaders });
    }
  }
  
  async processDecision(request) {
    try {
      const data = await request.json();
      const { submissionID, approved } = data;
      
      const submission = await this.env.D1_DB.prepare(
        "SELECT * FROM PENDING_SUBMISSION WHERE submissionID = ?"
      ).bind(submissionID).first();
      
      if (!submission) {
        return new Response(JSON.stringify({
          success: false,
          error: "Submission not found"
        }), { status: 404, headers: this.corsHeaders });
      }
      
      const officialStatusCtrl = new OfficialStatusController(this.env, this.corsHeaders);
      
      if (approved) {
        if (submission.orgID) {
          await officialStatusCtrl.acceptOrganization({ orgID: submission.orgID });
        } else if (submission.eventID) {
          await officialStatusCtrl.acceptEvent({ eventID: submission.eventID });
        }
      } else {
        await officialStatusCtrl.denySubmission(submission);
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: approved ? "Submission approved" : "Submission rejected"
      }), { headers: this.corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: this.corsHeaders });
    }
  }
}