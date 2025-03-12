import React from 'react';
import { Link } from 'react-router-dom';
import './EventPost.css';

function EventPost({ event }) {
  // Format date for display
  const formatDate = (dateString) => {
    const options = { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };
  
  // Calculate days remaining
  const getDaysRemaining = (dateString) => {
    const eventDate = new Date(dateString);
    const today = new Date();
    const timeDiff = eventDate - today;
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    if (daysDiff < 0) return 'Past event';
    if (daysDiff === 0) return 'Today!';
    if (daysDiff === 1) return 'Tomorrow!';
    return `${daysDiff} days away`;
  };

  return (
    <div className="event-post">
      <div className="event-post-header">
        <div className="event-post-avatar">
          {event.organizationThumbnail ? (
            <img src={event.organizationThumbnail} alt={event.organizationName} />
          ) : (
            <div className="event-org-placeholder">
              {event.organizationName?.charAt(0) || 'O'}
            </div>
          )}
        </div>
        <div className="event-post-meta">
          <Link to={`/organizations/${event.organizationID}`} className="event-org-name">
            {event.organizationName}
          </Link>
          <span className="event-timestamp">Posted on {formatDate(event.createdAt || new Date())}</span>
        </div>
        
        <div className="event-time-remaining">
          <span className="days-remaining">{getDaysRemaining(event.startDate)}</span>
        </div>
      </div>
      
      <Link to={`/events/${event.eventID}`} className="event-post-link">
        <h3 className="event-post-title">{event.title}</h3>
      </Link>
      
      <div className="event-post-details">
        <div className="event-date-location">
          <div className="event-date">
            <i className="far fa-calendar"></i>
            <span>{formatDate(event.startDate)}</span>
          </div>
          <div className="event-location">
            <i className="fas fa-map-marker-alt"></i>
            <span>{event.landmarkName || event.customLocation || 'Location TBA'}</span>
          </div>
        </div>
      </div>
      
      {event.thumbnail && (
        <div className="event-post-image">
          <img src={event.thumbnail} alt={event.title} />
        </div>
      )}
      
      <div className="event-post-content">
        <p className="event-description">{event.description}</p>
      </div>
      
      <div className="event-post-actions">
        <button className="event-action-btn rsvp-btn">
          <i className="far fa-calendar-check"></i> RSVP
        </button>
        <button className="event-action-btn share-btn">
          <i className="fas fa-share-alt"></i> Share
        </button>
        <Link to={`/events/${event.eventID}`} className="event-action-btn details-btn">
          <i className="fas fa-info-circle"></i> Details
        </Link>
      </div>
    </div>
  );
}

export default EventPost;