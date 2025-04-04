// Dummy controller to return some events
exports.getEvents = (req, res) => {
    const dummyEvents = [
      { id: 1, title: 'Study Session', date: '2025-03-10' },
      { id: 2, title: 'Guest Lecture', date: '2025-03-12' }
    ];
    res.json(dummyEvents);
  };

// Add this method to your EventController class

/**
 * Get all events a user has RSVP'd to with 'attending' status
 * @param {Request} request - The HTTP request
 * @returns {Response} JSON response with RSVP events
 */
exports.getUserRsvpEvents = async function(request) {
  // Verify the user is authenticated
  const userId = await this.auth.getUserIdFromRequest(request);
  if (!userId) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers: this.corsHeaders }
    );
  }

  try {
    // Get all RSVP entries for this user with status 'attending'
    const rsvps = await this.backendService.queryAll(
      `SELECT r.rsvpStatus, e.*, o.name as organizationName 
       FROM EVENT_RSVP r 
       JOIN EVENTS e ON r.eventID = e.eventID
       LEFT JOIN ORGANIZATIONS o ON e.organizationID = o.orgID
       WHERE r.userID = ? AND r.rsvpStatus = 'attending'`,
      [userId]
    );
    
    // Format the response
    const formattedRsvps = rsvps.map(rsvp => {
      return {
        rsvpStatus: rsvp.rsvpStatus,
        event: {
          eventID: rsvp.eventID,
          title: rsvp.title,
          description: rsvp.description,
          startDate: rsvp.startDate,
          endDate: rsvp.endDate,
          location: rsvp.location || rsvp.landmarkName || rsvp.customLocation,
          organizationName: rsvp.organizationName
        }
      };
    });

    return new Response(
      JSON.stringify({ success: true, rsvps: formattedRsvps }),
      { status: 200, headers: this.corsHeaders }
    );
  } catch (error) {
    console.error("Error fetching RSVP events:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to fetch RSVP events" }),
      { status: 500, headers: this.corsHeaders }
    );
  }
};
