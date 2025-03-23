import React from 'react';
import { Link } from 'react-router-dom';
import './EventPost.css';

const API_URL = process.env.REACT_APP_API_URL || 'https://the-quad-worker.gren9484.workers.dev';

// Use the same image URL formatter from OrganizationPage
const formatImageUrl = (url) => {
  if (!url) return null;
  
  // Return null for empty strings
  if (url === '') return null;
  
  // If URL is already absolute (starts with http or https)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Check if path already has /images/ prefix to avoid duplication
  if (url.startsWith('/images/')) {
    // Split into segments and encode only the necessary parts
    const pathSegments = url.substring(8).split('/');  // Remove '/images/' prefix
    
    // Encode each segment properly
    const encodedPath = pathSegments
      .map(segment => encodeURIComponent(segment))
      .join('/');
      
    return `${API_URL}/images/${encodedPath}`;
  }
  
  // Otherwise, route through our API
  return `${API_URL}/images/${encodeURIComponent(url)}`;
};

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

const EventPost = ({ event }) => {
  const isUpcoming = new Date(event.startDate) > new Date();
  
  return (
    <div className="event-post">
      <Link to={`/events/${event.eventID}`} className="event-post-link">
        <div className="event-post-thumbnail">
          {event.thumbnail ? (
            <div 
              className="event-image" 
              style={{
                backgroundImage: `url(${formatImageUrl(event.thumbnail)})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            />
          ) : (
            <div className="event-image-placeholder">
              <span>{event.title.charAt(0)}</span>
            </div>
          )}
          <div className="event-date-badge">
            {formatDate(event.startDate)}
          </div>
        </div>
        
        <div className="event-post-content">
          <h3 className="event-title">{event.title}</h3>
          <p className="event-description">
            {event.description ? (
              event.description.length > 120 ? 
              `${event.description.substring(0, 120)}...` : 
              event.description
            ) : 'No description provided.'}
          </p>
          
          <div className="event-post-footer">
            <span className={`event-status ${isUpcoming ? 'upcoming' : 'past'}`}>
              {isUpcoming ? 'Upcoming' : 'Past'}
            </span>
            <span className="view-details">View Details</span>
          </div>
        </div>
      </Link>
    </div>
  );
};

export default EventPost;