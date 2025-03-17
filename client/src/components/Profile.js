import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Profile.css';

function Profile() {
  const { currentUser, logout } = useAuth();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [events, setEvents] = useState([]);
  const navigate = useNavigate();
  
  // Add API URL constant
  const API_URL = process.env.REACT_APP_API_URL || 'https://the-quad-worker.gren9484.workers.dev';

  // Add formatImageUrl function to handle image paths correctly
  const formatImageUrl = (url) => {
    if (!url) return null;
    
    // Return null for empty strings
    if (url === '') return null;
    
    // If URL is already absolute (starts with http or https)
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // For direct R2 URLs, extract the proper path
      if (url.includes('r2.cloudflarestorage.com')) {
        // Extract everything after "/images/" including subdirectories
        const pathMatch = url.match(/\/images\/(.+)$/);
        if (pathMatch && pathMatch[1]) {
          return `${API_URL}/images/${pathMatch[1]}`;
        }
      }
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

  useEffect(() => {
    // Redirect if not logged in
    if (!currentUser) {
      navigate('/login');
      return;
    }

    async function fetchUserData() {
      try {
        // For now, just use the currentUser data we already have
        setUserData(currentUser);
        
        // Fetch organizations where user is admin
        const API_URL = process.env.REACT_APP_API_URL || 'https://the-quad-worker.gren9484.workers.dev';
        const orgResponse = await fetch(`${API_URL}/api/user-organizations?userID=${currentUser.id}`);
        
        if (!orgResponse.ok) {
          throw new Error(`Error fetching organizations: ${orgResponse.status}`);
        }
        
        const orgData = await orgResponse.json();
        if (orgData.success) {
          setOrganizations(orgData.organizations || []);
        }
        
        // You could also fetch events the user has created or is attending
        // For now, we'll leave this empty
        setEvents([]);
        
      } catch (err) {
        console.error("Error fetching profile data:", err);
        setError("Failed to load profile data. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [currentUser, navigate]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error("Failed to log out", err);
    }
  };

  if (loading) {
    return (
      <div className="profile-page-container">
        <div className="profile-container">
          <div className="loading">Loading profile data...</div>
        </div>
      </div>
    );
  }

  if (error || !userData) {
    return (
      <div className="profile-page-container">
        <div className="profile-container">
          <div className="error-message">{error || "Profile data could not be loaded"}</div>
          <button className="profile-button" onClick={() => navigate('/')}>Return Home</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="profile-page-container"></div>
      <div className="profile-container">
        <h2>Your Profile</h2>
        
        <div className="profile-section">
          <div className="profile-avatar">
            {userData.profile_picture ? (
              <img 
                src={userData.profile_picture} 
                alt={`${userData.f_name}'s profile`} 
              />
            ) : (
              <div className="profile-avatar-placeholder">
                {userData.f_name ? userData.f_name[0] : ''}
                {userData.l_name ? userData.l_name[0] : ''}
              </div>
            )}
          </div>
          
          <div className="profile-info">
            <h3>{userData.f_name} {userData.l_name}</h3>
            <p><strong>Email:</strong> {userData.email}</p>
            {userData.phone && <p><strong>Phone:</strong> {userData.phone}</p>}
          </div>
        </div>
        
        <div className="profile-section">
          <h3>Your Organizations</h3>
          {organizations.length > 0 ? (
            <div className="card-grid">
              {organizations.map(org => (
                <div key={org.orgID} className="card" onClick={() => navigate(`/organizations/${org.orgID}`)}>
                  <div className="card-header">
                    {org.thumbnail && (
                      <img src={formatImageUrl(org.thumbnail)} alt={org.name} />
                    )}
                  </div>
                  <div className="card-body">
                    <h4>{org.name}</h4>
                    <p>{org.description}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">You haven't created any organizations yet</p>
          )}
          
          <button 
            className="profile-button" 
            onClick={() => navigate('/register-organization')}
          >
            Create Organization
          </button>
        </div>
        
        <div className="profile-section">
          <h3>Your Events</h3>
          {events.length > 0 ? (
            <div className="card-grid">
              {events.map(event => (
                <div key={event.eventID} className="card">
                  <div className="card-header">
                    {event.thumbnail && (
                      <img src={formatImageUrl(event.thumbnail)} alt={event.title} />
                    )}
                  </div>
                  <div className="card-body">
                    <h4>{event.title}</h4>
                    <p>{event.description}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">You haven't created any events yet</p>
          )}
          
          <button 
            className="profile-button" 
            onClick={() => navigate('/register-event')}
          >
            Create Event
          </button>
        </div>
        
        <button className="logout-button" onClick={handleLogout}>
          Log Out
        </button>
      </div>
    </>
  );
}

export default Profile;