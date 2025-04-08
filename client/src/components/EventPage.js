export const API_URL = process.env.REACT_APP_API_URL || 'https://the-quad-worker.gren9484.workers.dev';

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './EventPage.css';
import MarkdownRenderer from './MarkdownRenderer';
import calendarController from '../controllers/CalendarController';

function EventPage() {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rsvpStatus, setRsvpStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isEventAdmin, setIsEventAdmin] = useState(false);

  // Fix the formatImageUrl function
  const formatImageUrl = (url) => {
    // Debug the URL being processed
    console.log("Processing image URL:", url);
    
    if (!url) return null;
    if (url === '') return null;
    
    // If already a complete URL, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // For paths that start with /images/, handle properly
    if (url.startsWith('/images/')) {
      // Keep the /images/ part intact and encode only the filename portion
      const baseUrl = `${API_URL}/images`;
      
      // For paths like /images/events/banners/filename.jpg
      // Split into segments and encode only the necessary parts
      const pathSegments = url.substring(8).split('/');  // Remove '/images/' prefix
      
      // Encode each segment properly
      const encodedPath = pathSegments
        .map(segment => encodeURIComponent(segment))
        .join('/');
        
      return `${baseUrl}/${encodedPath}`;
    }
    
    // For just a filename
    return `${API_URL}/images/${encodeURIComponent(url)}`;
  };

  // Format date
  const formatDate = (dateString) => {
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  // Get event duration
  const getEventDuration = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const durationMs = end - start;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours === 0) {
      return `${minutes} minutes`;
    } else if (minutes === 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minutes`;
    }
  };

  // Check if event is in the past
  const isEventPast = (endDate) => {
    return new Date(endDate) < new Date();
  };

  useEffect(() => {
    const fetchEventData = async () => {
      try {
        // Fetch event details
        const eventResponse = await fetch(`${API_URL}/api/events/${id}`);
        if (!eventResponse.ok) {
          throw new Error(`Failed to fetch event: ${eventResponse.status}`);
        }
        const eventData = await eventResponse.json();
        
        if (!eventData.success) {
          throw new Error(eventData.error || 'Failed to fetch event data');
        }
        
        setEvent(eventData.event);
        console.log("Fetched event:", eventData.event);
        console.log("Banner from API:", eventData.event.banner);
        
        // Fetch organization details
        const orgResponse = await fetch(`${API_URL}/api/organizations/${eventData.event.organizationID}`);
        if (!orgResponse.ok) {
          throw new Error(`Failed to fetch organization: ${orgResponse.status}`);
        }
        const orgData = await orgResponse.json();
        
        if (!orgData.success) {
          throw new Error(orgData.error || 'Failed to fetch organization data');
        }
        
        setOrganization(orgData.organization);

        // Check RSVP status if user is logged in
        if (currentUser) {
          const token = localStorage.getItem('token');
          if (!token) {
            console.warn('No authentication token found for RSVP status check');
            return;
          }

          const rsvpResponse = await fetch(`${API_URL}/api/events/${id}/rsvp-status`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (rsvpResponse.ok) {
            const rsvpData = await rsvpResponse.json();
            if (rsvpData.success && rsvpData.rsvpStatus) {
              setRsvpStatus(rsvpData.rsvpStatus);
            }
          } else {
            console.warn('Failed to fetch RSVP status:', rsvpResponse.status);
          }
        }
      } catch (error) {
        console.error('Error fetching event data:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEventData();
  }, [id, currentUser]);

  useEffect(() => {
    // Set up a listener for Google Calendar auth changes
    const handleAuthChange = async (isAuthenticated) => {
      console.log("Google Calendar auth changed:", isAuthenticated);
      
      if (isAuthenticated) {
        // Check for pending calendar event
        const pendingEvent = localStorage.getItem('pendingCalendarEvent');
        if (pendingEvent) {
          try {
            console.log("Found pending event to add to calendar");
            const eventData = JSON.parse(pendingEvent);
            console.log("Pending event data:", eventData);
            
            // Add delay to ensure auth is fully processed
            setTimeout(async () => {
              try {
                await calendarController.addRsvpToCalendar(eventData);
                console.log("Successfully added event to Google Calendar");
                setSuccessMessage("RSVP successful! Event was added to your Google Calendar.");
                localStorage.removeItem('pendingCalendarEvent');
              } catch (delayedError) {
                console.error('Failed to add event with delay:', delayedError);
              }
            }, 1000);
          } catch (error) {
            console.error('Failed to add pending event to calendar:', error);
          }
        }
      }
    };

    // Update event auth listener right away
    calendarController.setListeners({
      onAuthChange: handleAuthChange,
      onError: (error) => console.error("Calendar error:", error)
    });

    return () => {
      calendarController.setListeners({
        onAuthChange: () => {},
        onError: () => {}
      });
    };
  }, []);

useEffect(() => {
  // Set up a listener for Google Calendar auth changes
  const handleAuthChange = async (isAuthenticated) => {
    console.log("Google Calendar auth changed:", isAuthenticated);
    
    // Store auth state to prevent repeated syncs
    if (isAuthenticated && !window._lastCalendarAuthState) {
      window._lastCalendarAuthState = true;
      console.log("User is authenticated, syncing calendar...");
      try {
        await calendarController.ensureInitialized();
        await calendarController.syncCalendarWithRsvp();
        console.log("Calendar sync completed successfully");
      } catch (syncError) {
        console.error("Failed to sync calendar:", syncError);
      }
    } else if (!isAuthenticated) {
      window._lastCalendarAuthState = false;
    }
  };

  // Update event auth listener right away
  calendarController.setListeners({
    onAuthChange: handleAuthChange,
    onError: (error) => console.error("Calendar error:", error)
  });
  
  return () => {
    // Clean up listeners when component unmounts
    calendarController.setListeners({
      onAuthChange: () => {},
      onError: () => {}
    });
  };
}, []);

const handleRSVP = async (status) => {
  if (!currentUser) {
    navigate('/login', { state: { from: `/events/${id}`, message: 'You need to log in to RSVP for events.' } });
    return;
  }

  try {
    setIsSubmitting(true);
    
    // Submit RSVP to backend
    const response = await fetch(`${API_URL}/api/events/${id}/rsvp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        rsvpStatus: status
      })
    });

    const data = await response.json();
    
    if (data.success) {
      setRsvpStatus(status);
      let message = '';
      
      // Format event data for calendar operations
      const calendarEventData = {
        ...event,
        organizationName: organization ? organization.name : undefined
      };
      
      // If attending, add to calendar
      if (status === 'attending') {
        message = "RSVP successful! You're now attending this event.";
        
        // Check if Google Calendar is connected
        if (calendarController.isAuthenticated) {
          try {
            await calendarController.ensureInitialized();
            
            // Instead of syncing, directly add the event
            await calendarController.addRsvpToCalendar(calendarEventData);
            message += " Added to your Google Calendar.";
          } catch (calError) {
            console.error('Failed to add to Google Calendar:', calError);
            message += " Failed to update your Google Calendar.";
          }
        } else {
          message += " Connect your Google Calendar to sync events.";
          
          // Store the event data for when they connect
          localStorage.setItem('pendingCalendarEvent', JSON.stringify(calendarEventData));
          
          if (window.confirm("Connect your Google Calendar to sync events?")) {
            calendarController.signIn();
          }
        }
      } 
      // If maybe or declined, remove from calendar
      else if (status === 'maybe' || status === 'declined') {
        message = status === 'maybe' ? 
          "You've marked this event as maybe attending." : 
          "You've declined this event.";
        
        // Check if Google Calendar is connected
        if (calendarController.isAuthenticated) {
          try {
            await calendarController.ensureInitialized();
            const calendarId = await calendarController.findOrCreateQuadCalendar();
            
            // Get events from calendar
            const calendarEventsResponse = await window.gapi.client.calendar.events.list({
              calendarId: calendarId,
              q: event.title, // Search for this event title
              timeMin: new Date(event.startDate).toISOString(),
              timeMax: new Date(new Date(event.endDate).getTime() + 86400000).toISOString(),
              singleEvents: true
            });
            
            const calendarEvents = calendarEventsResponse.result.items || [];
            const eventsToDelete = calendarEvents.filter(calEvent => 
              calEvent.summary === event.title
            );
            
            // Remove matching events
            for (const eventToDelete of eventsToDelete) {
              await window.gapi.client.calendar.events.delete({
                calendarId: calendarId,
                eventId: eventToDelete.id
              });
            }
            
            if (eventsToDelete.length > 0) {
              message += " Event removed from your Google Calendar.";
            }
          } catch (calError) {
            console.error('Failed to update Google Calendar:', calError);
            message += " Failed to update your Google Calendar.";
          }
        } else {
          message += " Connect your Google Calendar to sync events.";
        }
      }
      
      setSuccessMessage(message);
      setTimeout(() => setSuccessMessage(''), 5000);
    } else {
      throw new Error(data.error || 'Failed to RSVP');
    }
  } catch (error) {
    console.error('RSVP error:', error);
    setError(`Failed to RSVP: ${error.message}`);
    setTimeout(() => setError(null), 5000);
  } finally {
    setIsSubmitting(false);
  }
};

const handleDeleteEvent = async () => {
  if (!confirm("Are you sure you want to delete this event? This action cannot be undone.")) {
    return;
  }

  try {
    setIsSubmitting(true);
    
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/api/events/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Redirect to homepage or events page after successful deletion
      navigate('/my-events');
    } else {
      setError(`Failed to delete event: ${data.error}`);
      setTimeout(() => setError(null), 5000);
    }
  } catch (error) {
    console.error('Error deleting event:', error);
    setError(`Failed to delete event: ${error.message}`);
    setTimeout(() => setError(null), 5000);
  } finally {
    setIsSubmitting(false);
  }
};

// Function to handle sharing to various platforms
const handleShare = (platform) => {
  console.log("handleShare triggered for platform:", platform);
  // Get the current URL for sharing
  const eventUrl = window.location.href;
  const eventTitle = event.title;
  const eventDescription = event.description ? 
    (event.description.length > 100 ? event.description.substring(0, 100) + '...' : event.description) : 
    'Check out this event on The Quad!';

  switch (platform) {
    case 'facebook':
      // Open Facebook share dialog
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(eventUrl)}`, 
        'facebook-share-dialog', 
        'width=626,height=436');
      break;
    case 'twitter':
      // Open Twitter share dialog with pre-populated content
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(eventTitle)}&url=${encodeURIComponent(eventUrl)}`,
        'twitter-share-dialog',
        'width=626,height=436');
      break;
    case 'email': {
      // Open email client with pre-populated subject and body
      const emailSubject = `Check out this event: ${eventTitle}`;
      const emailBody = `${eventTitle}\n\nEvent Details: ${eventUrl}`;
      const mailtoLink = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
      console.log("Mailto link:", mailtoLink);
      
      window.location.href = mailtoLink;
      break;
    }
    case 'link':
      // Copy link to clipboard
      navigator.clipboard.writeText(eventUrl)
        .then(() => {
          // Show temporary success message
          setSuccessMessage('Event link copied to clipboard!');
          setTimeout(() => setSuccessMessage(''), 3000);
        })
        .catch(err => {
          console.error('Failed to copy link: ', err);
          setError('Failed to copy link to clipboard');
          setTimeout(() => setError(null), 3000);
        });
      break;
    default:
      break;
  }
};

// Add this function to check admin status
const checkEventAdminStatus = async () => {
  if (!currentUser || !id) return;
  
  try {
    const response = await fetch(`${API_URL}/api/events/${id}/admin-status`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    const data = await response.json();
    setIsEventAdmin(data.isAdmin || false);
  } catch (error) {
    console.error("Error checking admin status:", error);
    setIsEventAdmin(false);
  }
};

useEffect(() => {
  if (event) {
    checkEventAdminStatus();
  }
}, [event, currentUser]);

  if (loading) {
    return (
      <div className="event-page-loading">
        <div className="event-loading-spinner"></div>
        <p>Loading event details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="event-page-error">
        <h2>Error Loading Event</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/events')}>Back to Events</button>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="event-page-error">
        <h2>Event Not Found</h2>
        <p>The event you're looking for doesn't exist or has been removed.</p>
        <button onClick={() => navigate('/events')}>Back to Events</button>
      </div>
    );
  }

  const isPast = isEventPast(event.endDate);

  return (
    <div className="event-page">
      {console.log("Event object:", event)}
      {console.log("Banner URL:", event.banner)}
      {console.log("Formatted banner URL:", event.banner ? formatImageUrl(event.banner) : "No banner")}
      
      <div 
        className="event-banner" 
        style={event.banner ? { 
          backgroundImage: `url(${formatImageUrl(event.banner)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        } : {
          backgroundColor: '#2d1537' // Fallback background color
        }}
      >
        <div className="event-banner-overlay">
          <h1>{event.title}</h1>
          {organization && (
            <Link to={`/organizations/${organization.orgID}`} className="event-organization-link">
              Hosted by {organization.name}
            </Link>
          )}
        </div>
      </div>
      
      {successMessage && (
        <div className="success-message">
          {successMessage}
        </div>
      )}
      
      <div className="event-content-container">
        <div className="event-main-content">
          <div className="event-details-section">
            <h2>Event Details</h2>
            <div className="event-meta">
              <div className="event-meta-item">
                <i className="fas fa-calendar-day"></i>
                <div className="event-meta-text">
                  <span className="meta-label">Date & Time</span>
                  <span className="meta-value">{formatDate(event.startDate)}</span>
                </div>
              </div>
              
              <div className="event-meta-item">
                <i className="fas fa-hourglass-half"></i>
                <div className="event-meta-text">
                  <span className="meta-label">Duration</span>
                  <span className="meta-value">{getEventDuration(event.startDate, event.endDate)}</span>
                </div>
              </div>
              
              <div className="event-meta-item">
                <i className="fas fa-map-marker-alt"></i>
                <div className="event-meta-text">
                  <span className="meta-label">Location</span>
                  <span className="meta-value">
                    {event.landmarkName || event.customLocation || 'Location not specified'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="event-description-section">
            <h2>About This Event</h2>
            <div className="event-description">
              {event.description ? (
                <MarkdownRenderer content={event.description} />
              ) : (
                <p className="no-description">No description provided.</p>
              )}
            </div>
          </div>
          
          <div className="event-actions">
            {!isPast ? (
              <>
                {!rsvpStatus ? (
                  <div className="rsvp-button-group">
                    <button 
                      className="rsvp-button attending" 
                      onClick={() => handleRSVP('attending')}
                      disabled={isSubmitting}
                    >
                      <i className="fas fa-check-circle"></i>
                      <span>I'll Attend</span>
                    </button>
                    <button 
                      className="rsvp-button maybe" 
                      onClick={() => handleRSVP('maybe')}
                      disabled={isSubmitting}
                    >
                      <i className="fas fa-question-circle"></i>
                      <span>Maybe</span>
                    </button>
                    <button 
                      className="rsvp-button decline" 
                      onClick={() => handleRSVP('declined')}
                      disabled={isSubmitting}
                    >
                      <i className="fas fa-times-circle"></i>
                      <span>Decline</span>
                    </button>
                  </div>
                ) : (
                  <div className="rsvp-status-container">
                    <div className={`rsvp-status ${rsvpStatus}`}>
                      <i className={rsvpStatus === 'attending' ? 'fas fa-check-circle' : 
                                    rsvpStatus === 'maybe' ? 'fas fa-question-circle' : 
                                    'fas fa-times-circle'}></i>
                      {rsvpStatus === 'attending' ? "You're attending this event" :
                      rsvpStatus === 'maybe' ? "You might attend this event" :
                      "You've declined this event"}
                    </div>
                    <div className="rsvp-button-group update">
                      <button 
                        className={`update-rsvp-button ${rsvpStatus === 'attending' ? 'active' : ''}`}
                        onClick={() => handleRSVP('attending')}
                        disabled={isSubmitting || rsvpStatus === 'attending'}
                      >
                        <i className="fas fa-check-circle"></i> Attend
                      </button>
                      <button 
                        className={`update-rsvp-button ${rsvpStatus === 'maybe' ? 'active' : ''}`}
                        onClick={() => handleRSVP('maybe')}
                        disabled={isSubmitting || rsvpStatus === 'maybe'}
                      >
                        <i className="fas fa-question-circle"></i> Maybe
                      </button>
                      <button 
                        className={`update-rsvp-button ${rsvpStatus === 'declined' ? 'active' : ''}`}
                        onClick={() => handleRSVP('declined')}
                        disabled={isSubmitting || rsvpStatus === 'declined'}
                      >
                        <i className="fas fa-times-circle"></i> Decline
                      </button>
                    </div>
                  </div>
                )}
                {/* Add delete button if user is logged in */}
                {isEventAdmin && (
                  <button 
                    className="delete-event-button"
                    onClick={handleDeleteEvent}
                    disabled={isSubmitting}
                  >
                    <i className="fas fa-trash"></i>
                    <span>Delete Event</span>
                  </button>
                )}
              </>
            ) : (
              <div className="event-past-notice">
                <i className="fas fa-hourglass-end"></i>
                This event has already ended
              </div>
            )}
          </div>
        </div>
        
        <div className="event-sidebar">
          {organization && (
            <div className="organization-card">
              <h3>About the Organizer</h3>
              <div className="org-logo">
                {organization.thumbnail ? (
                  <img src={formatImageUrl(organization.thumbnail)} alt={organization.name} />
                ) : (
                  <div className="org-logo-placeholder">
                    {organization.name.charAt(0)}
                  </div>
                )}
              </div>
              <h4>{organization.name}</h4>
              <p className="org-description-preview">
                {organization.description ? (
                  organization.description.length > 100 ? 
                  `${organization.description.substring(0, 100)}...` : 
                  organization.description
                ) : 'No description available.'}
              </p>
              <Link to={`/organizations/${organization.orgID}`} className="view-org-button">
                View Organization
              </Link>
            </div>
          )}
          
          <div className="share-card">
            <h3>Share This Event</h3>
            <div className="share-buttons">
              <button 
                className="share-button facebook"
                onClick={() => handleShare('facebook')}
                aria-label="Share on Facebook"
              >
                <i className="fab fa-facebook-f"></i>
              </button>
              <button 
                className="share-button twitter"
                onClick={() => handleShare('twitter')}
                aria-label="Share on Twitter"
              >
                <i className="fab fa-twitter"></i>
              </button>
              <button 
                className="share-button email"
                onClick={() => handleShare('email')}
                aria-label="Share via Email"
              >
                <i className="fas fa-envelope"></i>
              </button>
              <button 
                className="share-button link"
                onClick={() => handleShare('link')}
                aria-label="Copy Link"
              >
                <i className="fas fa-link"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EventPage;