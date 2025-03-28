import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Home.css';
import Footer from './Footer';
import MarkdownRenderer from './MarkdownRenderer';

const API_URL = process.env.REACT_APP_API_URL || 'https://the-quad-worker.gren9484.workers.dev';

function Home() {
  const { currentUser } = useAuth();
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [userEvents, setUserEvents] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        // Fetch featured/upcoming events for all users
        const eventsResponse = await fetch(`${API_URL}/api/events?limit=4`);
        if (!eventsResponse.ok) {
          throw new Error('Failed to fetch events');
        }
        const eventsData = await eventsResponse.json();
        setUpcomingEvents(eventsData.events || []);
        
        // If user is logged in, fetch personalized data
        if (currentUser) {
          const token = localStorage.getItem('token');
          
          // Fetch user's events
          const userEventsResponse = await fetch(`${API_URL}/api/user/events`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (userEventsResponse.ok) {
            const userEventsData = await userEventsResponse.json();
            setUserEvents(userEventsData.events || []);
          }
          
          // Fetch user's organizations
          const orgsResponse = await fetch(`${API_URL}/api/user-organizations?userID=${currentUser.id}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (orgsResponse.ok) {
            const orgsData = await orgsResponse.json();
            setOrganizations(orgsData.organizations || []);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [currentUser]);

  // Format date helper function
  const formatDate = (dateString) => {
    const options = { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  // Format image URL helper function
  const formatImageUrl = (url) => {
    if (!url) return null;
    
    // Return null for empty strings
    if (url === '') return null;
    
    // If already a complete URL, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // For paths that start with /images/, handle properly
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
  
  return (
    <div className="home-container">
      {/* Hero section */}
      <div className="hero-section">
        <div className="hero-content">
          <h1>Welcome to The Quad</h1>
          <p className="hero-subtitle">Your campus connection for events and organizations</p>
          
          {!currentUser && (
            <div className="hero-actions">
              <Link to="/signup" className="hero-button primary">Sign Up</Link>
              <Link to="/login" className="hero-button secondary">Log In</Link>
            </div>
          )}
        </div>
      </div>
      
      {/* Main content area */}
      <div className="home-content">
        {/* Personalized section for logged in users */}
        {currentUser && (
          <section className="welcome-section">
            <h2>Welcome back, {currentUser.f_name}!</h2>
            <div className="dashboard-cards">
              <div className="dashboard-card">
                <div className="card-icon">
                  <i className="fas fa-calendar-check"></i>
                </div>
                <div className="card-content">
                  <h3>{userEvents.filter(e => e.rsvpStatus === 'attending').length}</h3>
                  <p>Events you're attending</p>
                </div>
                <Link to="/my-events" className="card-link">View Events</Link>
              </div>
              
              <div className="dashboard-card">
                <div className="card-icon">
                  <i className="fas fa-users"></i>
                </div>
                <div className="card-content">
                  <h3>{organizations.length}</h3>
                  <p>Your organizations</p>
                </div>
                <Link to="/my-organizations" className="card-link">View Organizations</Link>
              </div>
              
              <div className="dashboard-card">
                <div className="card-icon">
                  <i className="fas fa-plus-circle"></i>
                </div>
                <div className="card-content">
                  <h3>Create</h3>
                  <p>New event or organization</p>
                </div>
                <div className="card-actions">
                  <Link to="/register-event" className="action-link">Create Event</Link>
                  <Link to="/register-organization" className="action-link">Create Organization</Link>
                </div>
              </div>
            </div>
          </section>
        )}
        
        {/* Upcoming events section - visible to all users */}
        <section className="events-section">
          <div className="section-header">
            <h2>Upcoming Events</h2>
            <Link to="/events" className="view-all-link">View All Events</Link>
          </div>
          
          {loading ? (
            <div className="loading-indicator">Loading upcoming events...</div>
          ) : error ? (
            <div className="error-message">Failed to load events: {error}</div>
          ) : upcomingEvents.length === 0 ? (
            <div className="no-content-message">No upcoming events found</div>
          ) : (
            <div className="event-cards">
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
                    <p className="event-organization">{event.organizationName}</p>
                    <Link to={`/events/${event.eventID}`} className="view-event-button">
                      View Event
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        
        {/* Organizations section - visible to all users */}
        <section className="orgs-section">
          <div className="section-header">
            <h2>Featured Organizations</h2>
            <Link to="/organizations" className="view-all-link">Explore Organizations</Link>
          </div>
          
          {/* This would ideally pull from an API, but for now we'll use a static CTA */}
          <div className="explore-orgs-cta">
            <div className="cta-content">
              <h3>Discover Campus Organizations</h3>
              <p>Find clubs, groups, and communities that match your interests</p>
              <Link to="/organizations" className="cta-button">Explore All Organizations</Link>
            </div>
          </div>
        </section>
      </div>
      
      <Footer />
    </div>
  );
}

export default Home;
