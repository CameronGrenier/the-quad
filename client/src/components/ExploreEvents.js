import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './ExploreEvents.css';  // We'll reuse some styles and add new ones
import ImageLoader from './ImageLoader';

const API_URL = process.env.REACT_APP_API_URL || 'https://the-quad-worker.gren9484.workers.dev';

function ExploreEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'upcoming', 'past', 'today'

  // Format image URL helper function
  const formatImageUrl = (url, isBackground = false) => {
    if (!url) return null;
    
    if (url === '') return null;
    
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (url.includes('r2.cloudflarestorage.com')) {
        const pathMatch = url.match(/\/images\/(.+)$/);
        if (pathMatch && pathMatch[1]) {
          return `${API_URL}/images/${pathMatch[1]}`;
        }
      }
      return url;
    }
    
    if (url.startsWith('/images/')) {
      return `${API_URL}${url}`;
    }
    
    return `${API_URL}/images/${url}`;
  };

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Note: This endpoint needs to be implemented in the backend
        const response = await fetch(`${API_URL}/api/events`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch events');
        }
        
        const data = await response.json();
        setEvents(data.events || []);
      } catch (error) {
        setError(error.message);
        console.error('Error fetching events:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchEvents();
  }, []);

  // Format date for display
  const formatEventDate = (dateString) => {
    const options = { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  // Filter events based on search term and date filter
  const filteredEvents = events.filter(event => {
    const matchesSearch = 
      event.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (event.description && event.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const now = new Date();
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);
    
    if (filter === 'all') return matchesSearch;
    
    if (filter === 'upcoming') {
      return matchesSearch && startDate > now;
    }
    
    if (filter === 'past') {
      return matchesSearch && endDate < now;
    }
    
    if (filter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      return matchesSearch && 
             startDate >= today && 
             startDate < tomorrow;
    }
    
    return matchesSearch;
  });

  return (
    <div className="event-list-page">
      <div className="event-list-header">
        <h1>Campus Events</h1>
        <p>Discover exciting events happening on campus</p>
      </div>
      
      <div className="event-list-controls">
        <div className={`search-container ${searchTerm ? 'has-text' : ''}`}>
          <i className="fas fa-search search-icon"></i>
          <input
            type="text"
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="event-search-input"
          />
          {searchTerm && (
            <button 
              className="clear-search" 
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
            >
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>
        
        <div className="filter-container">
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button 
            className={`filter-btn ${filter === 'upcoming' ? 'active' : ''}`}
            onClick={() => setFilter('upcoming')}
          >
            Upcoming
          </button>
          <button 
            className={`filter-btn ${filter === 'today' ? 'active' : ''}`}
            onClick={() => setFilter('today')}
          >
            Today
          </button>
          <button 
            className={`filter-btn ${filter === 'past' ? 'active' : ''}`}
            onClick={() => setFilter('past')}
          >
            Past
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="event-loading">
          <div className="event-loading-spinner"></div>
          <p>Loading events...</p>
        </div>
      ) : error ? (
        <div className="event-error">
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Try Again</button>
        </div>
      ) : (
        <div className="event-grid">
          {filteredEvents.length > 0 ? (
            filteredEvents.map(event => (
              <Link to={`/events/${event.eventID}`} key={event.eventID} className="event-card-link">
                <div className="event-card">
                  <div className="event-card-banner" 
                    style={event.banner ? {
                      backgroundImage: `url(${formatImageUrl(event.banner, true)})`
                    } : {
                      background: 'linear-gradient(to right, #4c2889, #c05621)'
                    }}>
                  </div>
                  <div className="event-card-organization">
                    {event.organizationName}
                  </div>
                  <div className="event-card-content">
                    <h3>{event.title}</h3>
                    <div className="event-card-meta">
                      <span className="event-date">{formatEventDate(event.startDate)}</span>
                      <span className="event-privacy-badge">{event.privacy === 'public' ? 'Public' : 'Private'}</span>
                    </div>
                    <p className="event-description-preview">
                      {event.description ? (
                        event.description.length > 100 ? 
                        `${event.description.substring(0, 100)}...` : 
                        event.description
                      ) : 'No description available.'}
                    </p>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="no-events-found">
              <h3>No events found</h3>
              <p>Try adjusting your search or filter criteria</p>
            </div>
          )}
        </div>
      )}
      
      <div className="create-event-container">
        <Link to="/register-event" className="create-event-button">
          Create New Event
        </Link>
      </div>
    </div>
  );
}

export default ExploreEvents;