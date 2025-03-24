import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // Add useNavigate
import { useAuth } from '../context/AuthContext';
import EventPost from './EventPost';
import './OrganizationPage.css';
import ImageLoader from './ImageLoader';
import MarkdownRenderer from './MarkdownRenderer';

const API_URL = process.env.REACT_APP_API_URL || 'https://the-quad-worker.gren9484.workers.dev';

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
    // URL already has correct prefix, just add API base URL
    return `${API_URL}${url}`;
  }
  
  // Otherwise, route through our API
  return `${API_URL}/images/${url}`;
};

function OrganizationPage() {
  const { orgId } = useParams();
  const navigate = useNavigate(); // Add useNavigate hook
  const { currentUser } = useAuth();
  const [organization, setOrganization] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Add state for delete confirmation dialog
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function fetchOrganizationData() {
      try {
        // Fetch organization details
        const orgResponse = await fetch(`${API_URL}/api/organizations/${orgId}`);
        if (!orgResponse.ok) {
          throw new Error('Failed to fetch organization details');
        }
        const orgData = await orgResponse.json();
        
        if (orgData.success) {
          setOrganization(orgData.organization);
          
          // Check if current user is an admin of this organization
          if (currentUser) {
            // Get current user ID (checking both property names)
            const currentUserId = currentUser.id || currentUser.userID;
            
            // Debug the admin check
            console.log("Admin check - Current user ID:", currentUserId);
            console.log("Admins:", orgData.organization.admins);
            
            // Check against both possible ID properties in the admin objects
            const isUserAdmin = orgData.organization.admins?.some(
              admin => (admin.id === currentUserId || admin.userID === currentUserId)
            );
            
            console.log("Is admin result:", isUserAdmin);
            setIsAdmin(isUserAdmin);
          }
        } else {
          throw new Error(orgData.error || 'Organization not found');
        }
        
        // Fetch organization events
        const eventsResponse = await fetch(`${API_URL}/api/organizations/${orgId}/events`);
        if (!eventsResponse.ok) {
          throw new Error('Failed to fetch organization events');
        }
        const eventsData = await eventsResponse.json();
        
        if (eventsData.success) {
          setEvents(eventsData.events);
        } else {
          throw new Error(eventsData.error || 'Failed to load events');
        }
      } catch (error) {
        console.error('Error fetching organization data:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchOrganizationData();
  }, [orgId, currentUser]);

  // Update the handleDeleteOrganization function
  const handleDeleteOrganization = async () => {
    if (!isAdmin || !currentUser) return;
    
    try {
      setIsDeleting(true);
      console.log("Deleting organization:", orgId);
      
      // Get the user ID (checking both property names)
      const userId = currentUser.id || currentUser.userID;
      console.log("Using user ID for deletion:", userId);
      
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/api/organizations/${orgId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userID: userId })
      });
      
      console.log("Delete response status:", response.status);
      
      const data = await response.json();
      console.log("Delete response data:", data);
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete organization');
      }
      
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      
      // Navigate back to organizations list after deletion
      navigate('/organizations');
    } catch (error) {
      console.error('Error deleting organization:', error);
      setError(error.message);
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="organization-page">
        <div className="org-loading-container">
          <div className="org-loading-spinner"></div>
          <p>Loading organization...</p>
        </div>
      </div>
    );
  }

  if (error || !organization) {
    return (
      <div className="organization-page">
        <div className="org-error-container">
          <h2>Error</h2>
          <p>{error || 'Organization not found'}</p>
          <a href="/organizations" className="back-link">Back to Organizations</a>
        </div>
      </div>
    );
  }

  return (
    <div className="organization-page">
      <div className="light-rays"></div>
      <div className="particles">
        {[...Array(15)].map((_, index) => {
          const size = Math.random() * 6 + 2;
          const left = Math.random() * 100;
          const animationDuration = Math.random() * 15 + 10;
          const delay = Math.random() * 15;
          const opacity = Math.random() * 0.3 + 0.1;
          
          return (
            <div
              key={index}
              className="particle"
              style={{
                width: `${size}px`,
                height: `${size}px`,
                left: `${left}%`,
                bottom: '-10px',
                animation: `float ${animationDuration}s linear ${delay}s infinite`,
                opacity
              }}
            />
          );
        })}
      </div>
      <div className="org-banner-container">
        <div 
          className="org-banner" 
          style={{ 
            backgroundImage: organization.banner ? 
              `url(${formatImageUrl(organization.banner)})` : 
              'linear-gradient(to right, #4c2889, #c05621)'
          }}
        >
          <div className="org-banner-overlay"></div>
        </div>
      </div>
      
      <div className="org-header">
        <div className="org-profile">
          <div className="org-avatar">
            {organization.thumbnail ? (
              <ImageLoader 
                src={organization.thumbnail} 
                alt={organization.name} 
                className="org-avatar-img"
              />
            ) : (
              <div className="org-avatar-placeholder">
                {organization.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="org-details">
            <h1>{organization.name}</h1>
            <p className="org-privacy">{organization.privacy === 'public' ? 'Public Organization' : 'Private Organization'}</p>
          </div>
        </div>
        
        {isAdmin && (
          <div className="org-actions">
            <button className="create-event-btn" onClick={() => window.location.href = "/register-event"}>
              Create Event
            </button>
            <button className="edit-org-btn" onClick={() => window.location.href = `/edit-organization/${orgId}`}>
              Edit Organization
            </button>
            <button className="delete-org-btn" onClick={() => setShowDeleteConfirm(true)}>
              Delete Organization
            </button>
          </div>
        )}
      </div>
      
      <div className="org-content">
        <div className="org-sidebar">
          <div className="org-info-card">
            <h3>About</h3>
            <div className="org-description-section">
              <h2>About This Organization</h2>
              <div className="org-description">
                {organization.description ? (
                  <MarkdownRenderer content={organization.description} />
                ) : (
                  <p className="no-description">No description provided.</p>
                )}
              </div>
            </div>
            <div className="org-stats">
              <div className="stat">
                <span className="stat-value">{events.length}</span>
                <span className="stat-label">Events</span>
              </div>
              <div className="stat">
                <span className="stat-value">{organization.memberCount || 0}</span>
                <span className="stat-label">Members</span>
              </div>
            </div>
          </div>
          
          {!isAdmin && currentUser && (
            <button className="join-org-btn">
              Join Organization
            </button>
          )}
        </div>
        
        <div className="events-feed">
          <h2>Upcoming Events</h2>
          
          {events.length > 0 ? (
            <div className="events-list">
              {events.map(event => (
                <EventPost key={event.eventID} event={event} />
              ))}
            </div>
          ) : (
            <div className="no-events">
              <p>No upcoming events</p>
              {isAdmin && (
                <button className="create-event-btn" onClick={() => window.location.href = "/register-event"}>
                  Create Your First Event
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add the delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="delete-confirm-overlay">
          <div className="delete-confirm-dialog">
            <h3>Delete Organization</h3>
            <p>Are you sure you want to delete this organization? This action cannot be undone and will delete all associated events.</p>
            <div className="delete-confirm-buttons">
              <button 
                className="cancel-button" 
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                className="delete-button" 
                onClick={handleDeleteOrganization}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Organization'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrganizationPage;