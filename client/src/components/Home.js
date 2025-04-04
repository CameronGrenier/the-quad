import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Home.css';
import Footer from './Footer';
import MarkdownRenderer from './MarkdownRenderer';
import Carousel from 'react-multi-carousel';
import 'react-multi-carousel/lib/styles.css';
import PersonalCalendar from './PersonalCalendar';
import { API_URL } from '../config/constants';

function Home() {
  const { currentUser } = useAuth();
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [userEvents, setUserEvents] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [officialOrgs, setOfficialOrgs] = useState([]);
  const [officialEvents, setOfficialEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        // Fetch featured/upcoming events for all users with filter parameter
        const eventsResponse = await fetch(`${API_URL}/api/events?limit=4&filter=upcoming`);
        if (!eventsResponse.ok) {
          throw new Error('Failed to fetch events');
        }
        const eventsData = await eventsResponse.json();
        
        // Double-check on frontend to ensure only future events are shown
        const now = new Date();
        const filteredEvents = (eventsData.events || [])
          .filter(event => new Date(event.startDate) > now)
          .sort((a, b) => new Date(a.startDate) - new Date(b.startDate)); // Sort by date ascending
        
        setUpcomingEvents(filteredEvents);
        
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
          
          // Fetch user's organizations (both admin and member)
          const userId = currentUser.id || currentUser.userID;
          
          // Fetch admin organizations
          const adminOrgsResponse = await fetch(`${API_URL}/api/user-organizations?userID=${userId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          // Fetch member organizations
          const memberOrgsResponse = await fetch(`${API_URL}/api/user-member-organizations?userID=${userId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          // Process both responses
          let allOrgs = [];
          
          if (adminOrgsResponse.ok) {
            const adminOrgsData = await adminOrgsResponse.json();
            if (adminOrgsData.success && adminOrgsData.organizations) {
              allOrgs = [...adminOrgsData.organizations];
            }
          }
          
          if (memberOrgsResponse.ok) {
            const memberOrgsData = await memberOrgsResponse.json();
            if (memberOrgsData.success && memberOrgsData.organizations) {
              // Filter out duplicates (in case user is both admin and member)
              const adminOrgIds = new Set(allOrgs.map(org => org.orgID));
              const newMemberOrgs = memberOrgsData.organizations.filter(org => 
                !adminOrgIds.has(org.orgID)
              );
              allOrgs = [...allOrgs, ...newMemberOrgs];
            }
          }
          
          setOrganizations(allOrgs);
        }

        // Fetch official organizations for the Featured Organizations section
        try {
          const officialOrgsResponse = await fetch(`${API_URL}/api/official-organizations?limit=4`);
          if (officialOrgsResponse.ok) {
            const officialOrgsData = await officialOrgsResponse.json();
            setOfficialOrgs(officialOrgsData.organizations || []);
          }
        } catch (error) {
          console.error('Error fetching official organizations:', error);
          // Don't set the main error state here to avoid disrupting the whole page
        }

        // Fetch official events
        try {
          const officialEventsResponse = await fetch(`${API_URL}/api/official-events?limit=6`);
          if (officialEventsResponse.ok) {
            const officialEventsData = await officialEventsResponse.json();
            setOfficialEvents(officialEventsData.events || []);
          }
        } catch (error) {
          console.error('Error fetching official events:', error);
          // Don't set the main error state to avoid disrupting the whole page
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
                  <h3>{userEvents
                    .filter(e => e.rsvpStatus === 'attending' || e.role === 'attending')
                    .filter(e => new Date(e.startDate) > new Date())
                    .length}</h3>
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
          
          {loading ? (
            <div className="loading-indicator">Loading featured organizations...</div>
          ) : officialOrgs.length === 0 ? (
            <div className="explore-orgs-cta">
              <div className="cta-content">
                <h3>Discover Campus Organizations</h3>
                <p>Find clubs, groups, and communities that match your interests</p>
                <Link to="/organizations" className="cta-button">Explore All Organizations</Link>
              </div>
            </div>
          ) : (
            <Carousel
              responsive={{
                superLargeDesktop: {
                  breakpoint: { max: 4000, min: 1200 },
                  items: 3,
                  slidesToSlide: 1
                },
                desktop: {
                  breakpoint: { max: 1200, min: 992 },
                  items: 3,
                  slidesToSlide: 1
                },
                tablet: {
                  breakpoint: { max: 992, min: 576 },
                  items: 2,
                  slidesToSlide: 1
                },
                mobile: {
                  breakpoint: { max: 576, min: 0 },
                  items: 1,
                  slidesToSlide: 1
                }
              }}
              containerClass="org-carousel-container"
              itemClass="org-carousel-item"
              dotListClass="org-carousel-dots"
              sliderClass="org-carousel-slider"
              infinite={true}
              autoPlay={officialOrgs.length > 3}
              autoPlaySpeed={5000}
              keyBoardControl={true}
              customTransition="transform 500ms ease-in-out"
              transitionDuration={500}
              removeArrowOnDeviceType={["mobile"]}
              dotColorActive="#9168ff"
              dotColor="rgba(255, 255, 255, 0.5)"
              showDots={true}
            >
              {officialOrgs.map(org => (
                <div key={org.orgID} className="org-card">
                  <div 
                    className="org-image" 
                    style={org.thumbnail ? { 
                      backgroundImage: `url(${formatImageUrl(org.thumbnail)})` 
                    } : {}}
                  >
                    <div className="official-badge">
                      <i className="fas fa-crown"></i> Official
                    </div>
                    {org.memberCount !== undefined && (
                      <div className="org-member-count">
                        <i className="fas fa-users"></i> {org.memberCount || 0} Members
                      </div>
                    )}
                  </div>
                  <div className="org-details">
                    <h3>{org.name}</h3>
                    <p className="org-description">
                      {org.description ? (
                        org.description.length > 100 ? 
                          `${org.description.substring(0, 100)}...` : 
                          org.description
                      ) : 'No description available'}
                    </p>
                    <Link to={`/organizations/${org.orgID}`} className="view-org-button">
                      View Organization
                    </Link>
                  </div>
                </div>
              ))}
            </Carousel>
          )}
        </section>

        {/* Official Events Section */}
        <section className="official-events-section">
          <div className="section-header">
            <h2>Official Campus Events</h2>
            <Link to="/events?filter=official" className="view-all-link">View All</Link>
          </div>
          
          <p className="section-intro">
            Discover events sponsored and endorsed by the university. These official events represent the pinnacle of campus activities.
          </p>
          
          {loading ? (
            <div className="loading-indicator">Loading official events...</div>
          ) : officialEvents.length === 0 ? (
            <div className="explore-events-cta">
              <div className="cta-content">
                <h3>No Official Events Currently</h3>
                <p>Check back soon for university sponsored events and activities</p>
                <Link to="/events" className="cta-button">Browse All Events</Link>
              </div>
            </div>
          ) : (
            <Carousel
              responsive={{
                superLargeDesktop: {
                  breakpoint: { max: 4000, min: 1200 },
                  items: 3,
                  slidesToSlide: 1
                },
                desktop: {
                  breakpoint: { max: 1200, min: 992 },
                  items: 3,
                  slidesToSlide: 1
                },
                tablet: {
                  breakpoint: { max: 992, min: 576 },
                  items: 2,
                  slidesToSlide: 1
                },
                mobile: {
                  breakpoint: { max: 576, min: 0 },
                  items: 1,
                  slidesToSlide: 1
                }
              }}
              containerClass="event-carousel-container"
              itemClass="event-carousel-item"
              dotListClass="event-carousel-dots"
              sliderClass="event-carousel-slider"
              infinite={true}
              autoPlay={officialEvents.length > 3}
              autoPlaySpeed={5000}
              keyBoardControl={true}
              customTransition="transform 500ms ease-in-out"
              transitionDuration={500}
              removeArrowOnDeviceType={["mobile"]}
              dotColorActive="#9168ff"
              dotColor="rgba(255, 255, 255, 0.5)"
              showDots={true}
            >
              {officialEvents.map(event => (
                <div key={event.eventID} className="official-event-card">
                  <div 
                    className="event-image" 
                    style={event.thumbnail ? { 
                      backgroundImage: `url(${formatImageUrl(event.thumbnail)})` 
                    } : {}}
                  >
                    <div className="official-badge">
                      <i className="fas fa-certificate"></i> Official
                    </div>
                    <div className="event-date-badge">
                      {formatDate(event.startDate)}
                    </div>
                  </div>
                  <div className="event-details">
                    <h3>{event.title}</h3>
                    <p className="event-location">
                      <i className="fas fa-map-marker-alt"></i> {event.landmarkName || event.customLocation || 'Location TBA'}
                    </p>
                    {event.organizationName && (
                      <p className="event-organization">
                        <i className="fas fa-users"></i> {event.organizationName}
                      </p>
                    )}
                    <p className="event-description">
                      {event.description ? (
                        event.description.length > 80 ? 
                          `${event.description.substring(0, 80)}...` : 
                          event.description
                      ) : 'No description available'}
                    </p>
                    <Link to={`/events/${event.eventID}`} className="view-event-button">
                      View Details
                    </Link>
                  </div>
                </div>
              ))}
            </Carousel>
          )}
        </section>

        {/* Calendar Section - Only visible to logged in users */}
        {currentUser && (
          <section className="calendar-section">
            <div className="section-header">
              <h2>Your Calendar</h2>
              <Link to="/calendar" className="view-all-link">View Full Calendar</Link>
            </div>
            
            <div className="calendar-container">
              <PersonalCalendar 
                compact={true} 
                height="500px"
                defaultView="dayGridMonth"
                limit={5}
              />
            </div>
          </section>
        )}
      </div>
      
      <Footer />
    </div>
  );
}

export default Home;
