import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './EventPage.css';

const API_URL = process.env.REACT_APP_API_URL || 'https://the-quad-worker.gren9484.workers.dev';

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

  const handleRSVP = async () => {
    if (!currentUser) {
      navigate('/login', { state: { from: `/events/${id}`, message: 'You need to log in to RSVP for events.' } });
      return;
    }

    try {
      setIsSubmitting(true);
      
      const response = await fetch(`${API_URL}/api/events/${id}/rsvp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          rsvpStatus: 'attending' // Changed from 'going' to 'attending'
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setRsvpStatus('attending'); // Changed from 'going' to 'attending'
        setSuccessMessage('RSVP successful! You\'re now attending this event.');
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

  const cancelRSVP = async () => {
    try {
      setIsSubmitting(true);
      
      const response = await fetch(`${API_URL}/api/events/${id}/rsvp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          rsvpStatus: 'declined' // Changed from 'not going' to 'declined'
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setRsvpStatus('');
        setSuccessMessage('Your RSVP has been canceled.');
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        throw new Error(data.error || 'Failed to cancel RSVP');
      }
    } catch (error) {
      console.error('Cancel RSVP error:', error);
      setError(`Failed to cancel RSVP: ${error.message}`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

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
                <i className="fas fa-calendar"></i>
                <div className="event-meta-text">
                  <span className="meta-label">Date & Time</span>
                  <span className="meta-value">{formatDate(event.startDate)}</span>
                </div>
              </div>
              
              <div className="event-meta-item">
                <i className="fas fa-clock"></i>
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
                <p>{event.description}</p>
              ) : (
                <p className="no-description">No description provided.</p>
              )}
            </div>
          </div>
          
          <div className="event-actions">
            {!isPast ? (
              <>
                {rsvpStatus !== 'attending' ? ( // Changed from 'going' to 'attending'
                  <button 
                    className="rsvp-button" 
                    onClick={handleRSVP}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Processing...' : 'RSVP Now'}
                  </button>
                ) : (
                  <div className="rsvp-status-container">
                    <div className="rsvp-status">
                      <i className="fas fa-check-circle"></i>
                      You're attending this event
                    </div>
                    <button 
                      className="cancel-rsvp-button" 
                      onClick={cancelRSVP}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Processing...' : 'Cancel RSVP'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="event-past-notice">
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
              <button className="share-button facebook">
                <i className="fab fa-facebook-f"></i>
              </button>
              <button className="share-button twitter">
                <i className="fab fa-twitter"></i>
              </button>
              <button className="share-button email">
                <i className="fas fa-envelope"></i>
              </button>
              <button className="share-button link" onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert("Link copied to clipboard!");
              }}>
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