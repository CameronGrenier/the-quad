import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './MyEvents.css';

const API_URL = process.env.REACT_APP_API_URL || 'https://the-quad-worker.gren9484.workers.dev';

function MyEvents() {
  // Add this missing state variable
  const [updating, setUpdating] = useState({});
  
  // Keep your existing state variables
  const { currentUser } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('attending');
  const [showDebug, setShowDebug] = useState(false);

  // Add this function to properly format image URLs
  const formatImageUrl = (url) => {
    if (!url) return null;
    
    // If it's already a complete URL, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // For paths that start with /images/
    if (url.startsWith('/images/')) {
      // Split into segments and encode only the necessary parts
      const pathSegments = url.substring(8).split('/');  // Remove '/images/' prefix
      
      // Encode each segment properly
      const encodedPath = pathSegments
        .map(segment => encodeURIComponent(segment))
        .join('/');
        
      return `${API_URL}/images/${encodedPath}`;
    }
    
    // For just a filename
    return `${API_URL}/images/${encodeURIComponent(url)}`;
  };

  useEffect(() => {
    const fetchUserEvents = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/user/events`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch user events: ${response.status}`);
        }

        const data = await response.json();
        if (data.success) {
          setEvents(data.events);
        } else {
          throw new Error(data.error || 'Failed to fetch event data');
        }
      } catch (error) {
        console.error('Error fetching user events:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUserEvents();
  }, [currentUser]);

  const formatDate = (dateString) => {
    const options = { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  // Update the filtering logic to be more robust
  const filteredEvents = events.filter(event => {
    if (activeTab === 'attending') {
      return event.rsvpStatus === 'attending' || 
             (event.role === 'attending' && !event.isOrganizer);
    }
    if (activeTab === 'maybe') {
      return event.rsvpStatus === 'maybe' || 
             (event.role === 'maybe' && !event.isOrganizer);
    }
    if (activeTab === 'declined') {
      return event.rsvpStatus === 'declined' || 
             (event.role === 'declined' && !event.isOrganizer);
    }
    if (activeTab === 'organized') {
      return event.isOrganizer === true || event.role === 'admin';
    }
    return true; // 'all' tab
  });

  // Organize events by date (upcoming first, then past)
  const now = new Date();
  const upcomingEvents = filteredEvents.filter(event => new Date(event.startDate) > now)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  
  const pastEvents = filteredEvents.filter(event => new Date(event.startDate) <= now)
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

  const toggleDebug = () => setShowDebug(!showDebug);

  // Update the handleRSVP function to use the updating state
  const handleRSVP = async (eventId, status) => {
    try {
      // Track which event is being updated
      setUpdating(prev => ({ ...prev, [eventId]: true }));
      
      // Your existing RSVP code...
      const response = await fetch(`${API_URL}/api/events/${eventId}/rsvp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Update the events array with the new status
        setEvents(events.map(event => 
          event.eventID === eventId ? {...event, rsvpStatus: status} : event
        ));
      } else {
        console.error("Failed to update RSVP status:", data.error);
      }
    } catch (err) {
      console.error("RSVP error:", err);
    } finally {
      // Clear the updating state for this event
      setUpdating(prev => ({ ...prev, [eventId]: false }));
    }
  };

  if (!currentUser) {
    return (
      <div className="my-events-container">
        <div className="login-prompt">
          <h2>Please log in to see your events</h2>
          <Link to="/login" className="login-button">Log In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="my-events-container">
      <h1>My Events</h1>
      
      {/* <div className="debug-section">
        <button onClick={toggleDebug} className="debug-toggle">
          {showDebug ? 'Hide Debug Info' : 'Show Debug Info'}
        </button>
        
        {showDebug && (
          <div className="debug-info">
            <h3>Debug Information</h3>
            <p>Total events: {events.length}</p>
            <p>Filtered events: {filteredEvents.length}</p>
            <p>Active tab: {activeTab}</p>
            <details>
              <summary>Event Data</summary>
              <pre>{JSON.stringify(events, null, 2)}</pre>
            </details>
          </div>
        )}
      </div> */}

      <div className="event-tabs">
        <button 
          className={`tab-button ${activeTab === 'attending' ? 'active' : ''}`} 
          onClick={() => setActiveTab('attending')}
        >
          Attending
        </button>
        <button 
          className={`tab-button ${activeTab === 'maybe' ? 'active' : ''}`} 
          onClick={() => setActiveTab('maybe')}
        >
          Maybe
        </button>
        <button 
          className={`tab-button ${activeTab === 'declined' ? 'active' : ''}`} 
          onClick={() => setActiveTab('declined')}
        >
          Declined
        </button>
        <button 
          className={`tab-button ${activeTab === 'organized' ? 'active' : ''}`} 
          onClick={() => setActiveTab('organized')}
        >
          Organizing
        </button>
        <button 
          className={`tab-button ${activeTab === 'all' ? 'active' : ''}`} 
          onClick={() => setActiveTab('all')}
        >
          All
        </button>
      </div>
      
      {loading ? (
        <div className="loading">Loading your events...</div>
      ) : error ? (
        <div className="error-message">Error: {error}</div>
      ) : filteredEvents.length === 0 ? (
        <div className="no-events-message">
          <p>You don't have any {activeTab === 'all' ? '' : activeTab} events.</p>
          <Link to="/events" className="browse-events-button">Browse Events</Link>
        </div>
      ) : (
        <div className="events-lists">
          {upcomingEvents.length > 0 && (
            <div className="events-section">
              <h2>Upcoming Events</h2>
              <div className="events-grid">
                {upcomingEvents.map(event => (
                  <div key={event.eventID} className="event-card">
                    <div 
                      className="event-image" 
                      style={event.thumbnail ? { 
                        backgroundImage: `url(${formatImageUrl(event.thumbnail)})` 
                      } : {}}
                    >
                      <div className="event-date-badge">
                        {formatDate(event.startDate)}
                      </div>
                    </div>
                    <div className="event-details">
                      <h3>{event.title}</h3>
                      <p className="event-location">
                        {event.landmarkName || event.customLocation || 'Location not specified'}
                      </p>
                      <div className="event-status">
                        <span className={`status-badge ${event.rsvpStatus || event.role}`}>
                          {(event.rsvpStatus === 'attending' || event.role === 'attending') ? 'Attending' : 
                           (event.rsvpStatus === 'maybe' || event.role === 'maybe') ? 'Maybe' : 
                           (event.rsvpStatus === 'declined' || event.role === 'declined') ? 'Declined' : 
                           event.isOrganizer || event.role === 'admin' ? 'Organizing' : ''}
                        </span>
                      </div>
                      {!event.isOrganizer && event.role !== 'admin' && (
                        <div className="event-rsvp-actions">
                          <button 
                            className={`rsvp-button attending ${event.rsvpStatus === 'attending' || event.role === 'attending' ? 'active' : ''}`}
                            onClick={() => handleRSVP(event.eventID, 'attending')}
                            disabled={updating[event.eventID]}
                          >
                            {updating[event.eventID] ? 'Updating...' : 'Attend'}
                          </button>
                          <button 
                            className={`rsvp-button maybe ${event.rsvpStatus === 'maybe' || event.role === 'maybe' ? 'active' : ''}`}
                            onClick={() => handleRSVP(event.eventID, 'maybe')}
                            disabled={updating[event.eventID]}
                          >
                            Maybe
                          </button>
                          <button 
                            className={`rsvp-button declined ${event.rsvpStatus === 'declined' || event.role === 'declined' ? 'active' : ''}`}
                            onClick={() => handleRSVP(event.eventID, 'declined')}
                            disabled={updating[event.eventID]}
                          >
                            Decline
                          </button>
                        </div>
                      )}
                      <Link to={`/events/${event.eventID}`} className="view-event-button">
                        View Event
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {pastEvents.length > 0 && (
            <div className="events-section past">
              <h2>Past Events</h2>
              <div className="events-grid">
                {pastEvents.map(event => (
                  <div key={event.eventID} className="event-card past">
                    <div 
                      className="event-image" 
                      style={event.thumbnail ? { 
                        backgroundImage: `url(${formatImageUrl(event.thumbnail)})` 
                      } : {}}
                    >
                      <div className="event-date-badge past">
                        {formatDate(event.startDate)}
                      </div>
                    </div>
                    <div className="event-details">
                      <h3>{event.title}</h3>
                      <p className="event-location">
                        {event.landmarkName || event.customLocation || 'Location not specified'}
                      </p>
                      <div className="event-status">
                        <span className={`status-badge ${event.rsvpStatus || event.role}`}>
                          {(event.rsvpStatus === 'attending' || event.role === 'attending') ? 'Attended' : 
                           (event.rsvpStatus === 'maybe' || event.role === 'maybe') ? 'Maybe' : 
                           (event.rsvpStatus === 'declined' || event.role === 'declined') ? 'Declined' : 
                           event.isOrganizer || event.role === 'admin' ? 'Organized' : ''}
                        </span>
                      </div>
                      <Link to={`/events/${event.eventID}`} className="view-event-button">
                        View Event
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MyEvents;