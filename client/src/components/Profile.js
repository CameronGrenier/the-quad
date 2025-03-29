import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Profile.css';

const API_URL = process.env.REACT_APP_API_URL || 'https://the-quad-worker.gren9484.workers.dev';

function Profile() {
  const { currentUser, logout, updateCurrentUser } = useAuth();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [events, setEvents] = useState([]);
  const navigate = useNavigate();
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    f_name: '',
    l_name: '',
    email: '',
    phone: '',
    profile_picture: null
  });
  const [previewImage, setPreviewImage] = useState(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [updateError, setUpdateError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update the formatImageUrl function
  const formatImageUrl = (url) => {
    if (!url) return null;
    if (url === '') return null;
    
    console.log("Formatting image URL:", url);
    
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // The issue is here - for profile pictures, we need the full path
    if (url.includes('profile_pictures/')) {
      // Use the complete URL without splitting it
      return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    }
    
    if (url.startsWith('/images/')) {
      return `${API_URL}${url}`;
    }
    
    return `${API_URL}/images/${url}`;
  };

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    async function fetchUserData() {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError("Authentication token missing, please log in again");
          navigate('/login');
          return;
        }
        
        console.log("Using token for profile fetch:", token.substring(0, 15) + "...");
        
        const response = await fetch(`${API_URL}/api/user-profile`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log("Profile API response status:", response.status);
        
        // Add more visible error reporting
        if (!response.ok) {
          const errorText = await response.text();
          console.error("Profile API error:", response.status, errorText);
          throw new Error(`Failed to fetch profile data: ${response.status} ${errorText}`);
        }
        
        const data = await response.json();
        console.log("Profile API response data:", data);
        
        if (data.success && data.user) {
          setUserData(data.user);
          setFormData({
            f_name: data.user.f_name || '',
            l_name: data.user.l_name || '',
            email: data.user.email || '',
            phone: data.user.phone || '',
            profile_picture: null
          });
        } else {
          console.error("User data missing in response:", data);
          
          // Try to recover by using currentUser data
          if (currentUser) {
            setUserData(currentUser);
            setFormData({
              f_name: currentUser.f_name || '',
              l_name: currentUser.l_name || '',
              email: currentUser.email || '',
              phone: currentUser.phone || '',
              profile_picture: null
            });
          } else {
            setError("Failed to load profile data - missing user information");
          }
        }
        
        // Fetch organizations
        const orgsResponse = await fetch(`${API_URL}/api/user-organizations?userID=${currentUser.id || currentUser.userID}`);
        if (orgsResponse.ok) {
          const orgsData = await orgsResponse.json();
          if (orgsData.success) setOrganizations(orgsData.organizations || []);
        }
        
        // Fetch user's events
        const eventsResponse = await fetch(`${API_URL}/api/user/events`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (eventsResponse.ok) {
          const eventsData = await eventsResponse.json();
          setEvents(eventsData.events || []);
        }
        
      } catch (err) {
        console.error("Error fetching profile data:", err);
        // More helpful error message including the error details
        setError(`Failed to load profile data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [currentUser, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({ ...prev, profile_picture: file }));
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewImage(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setUpdateError(null);
    
    try {
      const token = localStorage.getItem('token');
      
      const formDataToSend = new FormData();
      formDataToSend.append('userID', userData.userID || currentUser.id || currentUser.userID);
      formDataToSend.append('f_name', formData.f_name);
      formDataToSend.append('l_name', formData.l_name);
      formDataToSend.append('email', formData.email);
      formDataToSend.append('phone', formData.phone || '');
      
      if (formData.profile_picture) {
        formDataToSend.append('profile_picture', formData.profile_picture);
      }
      
      const response = await fetch(`${API_URL}/api/update-profile`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataToSend
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Update local state
        setUserData(result.user);
        updateCurrentUser({
          ...currentUser,
          ...result.user
        });
        
        setUpdateSuccess(true);
        setIsEditing(false);
        
        setTimeout(() => {
          setUpdateSuccess(false);
        }, 3000);
      } else {
        setUpdateError(result.error || 'Failed to update profile');
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      setUpdateError('An error occurred while updating your profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="profile-page loading">Loading profile data...</div>;
  }

  return (
    <div className="profile-page">
      <div className="profile-page-background"></div>
      
      <div className="profile-container">
        <h1>Your Profile</h1>
        
        {/* Display errors prominently */}
        {error && (
          <div className="error-message alert">
            <i className="fas fa-exclamation-circle"></i> {error}
          </div>
        )}
        
        {updateSuccess && (
          <div className="success-message">
            <i className="fas fa-check-circle"></i> Profile updated successfully!
          </div>
        )}
        
        {updateError && (
          <div className="error-message">
            <i className="fas fa-exclamation-circle"></i> {updateError}
          </div>
        )}
        
        {/* Main Profile Card */}
        <div className="profile-card">
          {!isEditing ? (
            // VIEW MODE
            <div className="profile-view">
              {/* User Avatar and Edit Button */}
              <div className="profile-header">
                <div className="profile-avatar">
                  {userData?.profile_picture ? (
                    <img 
                      src={formatImageUrl(userData.profile_picture)} 
                      alt="Profile" 
                      className="avatar-image"
                      onError={(e) => {
                        console.log("Image failed to load, using placeholder");
                        e.target.onerror = null;
                        e.target.src = 'https://via.placeholder.com/150?text=Profile';
                      }}
                    />
                  ) : (
                    <div className="avatar-placeholder">
                      {userData?.f_name?.charAt(0) || ''}{userData?.l_name?.charAt(0) || ''}
                    </div>
                  )}
                </div>
                
                {/* Prominent Edit Button */}
                <button 
                  className="edit-profile-button"
                  onClick={() => setIsEditing(true)}
                >
                  <i className="fas fa-pencil-alt"></i> Edit Profile
                </button>
              </div>
              
              {/* User Info */}
              <div className="profile-details">
                <h2>{userData?.f_name} {userData?.l_name}</h2>
                
                <div className="info-grid">
                  <div className="info-item">
                    <label>Email</label>
                    <p>{userData?.email}</p>
                  </div>
                  
                  <div className="info-item">
                    <label>Phone</label>
                    <p>{userData?.phone || 'Not provided'}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // EDIT MODE
            <form className="profile-edit-form" onSubmit={handleSubmit}>
              <h2>Edit Your Information</h2>
              
              {/* Profile Picture Upload */}
              <div className="profile-picture-upload">
                <div className="profile-avatar large">
                  {previewImage ? (
                    <img src={previewImage} alt="Profile Preview" className="avatar-image" />
                  ) : userData?.profile_picture ? (
                    <img src={formatImageUrl(userData.profile_picture)} alt="Profile" className="avatar-image" />
                  ) : (
                    <div className="avatar-placeholder">
                      {userData?.f_name?.charAt(0) || ''}{userData?.l_name?.charAt(0) || ''}
                    </div>
                  )}
                  
                  <div className="avatar-overlay">
                    <label htmlFor="profile-picture" className="avatar-change-label">
                      <i className="fas fa-camera"></i>
                      <span>Change Photo</span>
                    </label>
                    <input
                      id="profile-picture"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="file-input"
                    />
                  </div>
                </div>
              </div>
              
              {/* Form Fields */}
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="f_name">First Name</label>
                  <input
                    type="text"
                    id="f_name"
                    name="f_name"
                    value={formData.f_name}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="l_name">Last Name</label>
                  <input
                    type="text"
                    id="l_name"
                    name="l_name"
                    value={formData.l_name}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div className="form-group full-width">
                  <label htmlFor="email">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div className="form-group full-width">
                  <label htmlFor="phone">Phone Number (optional)</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
              
              {/* Form Buttons */}
              <div className="form-buttons">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => {
                    setIsEditing(false);
                    setPreviewImage(null);
                    setFormData({
                      f_name: userData?.f_name || '',
                      l_name: userData?.l_name || '',
                      email: userData?.email || '',
                      phone: userData?.phone || '',
                      profile_picture: null
                    });
                  }}
                >
                  Cancel
                </button>
                
                <button
                  type="submit"
                  className="save-button"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
        </div>
        
        {/* Your Organizations */}
        <div className="profile-section">
          <div className="section-header">
            <h2>Your Organizations</h2>
            <button 
              onClick={() => navigate('/register-organization')}
              className="action-button"
            >
              <i className="fas fa-plus"></i> Create Organization
            </button>
          </div>
          
          {organizations.length > 0 ? (
            <div className="cards-grid">
              {organizations.map(org => (
                <div key={org.orgID} className="org-card" onClick={() => navigate(`/organizations/${org.orgID}`)}>
                  <div className="org-card-header">
                    {org.thumbnail ? (
                      <img src={formatImageUrl(org.thumbnail)} alt={org.name} />
                    ) : (
                      <div className="org-placeholder">{org.name.charAt(0)}</div>
                    )}
                  </div>
                  <div className="org-card-content">
                    <h3>{org.name}</h3>
                    <p className="org-privacy">{org.privacy === 'public' ? 'Public' : 'Private'}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <i className="fas fa-users"></i>
              <p>You haven't created any organizations yet</p>
              <button onClick={() => navigate('/register-organization')}>Create Your First Organization</button>
            </div>
          )}
        </div>
        
        {/* Your Events */}
        <div className="profile-section">
          <div className="section-header">
            <h2>Your Events</h2>
            <button 
              onClick={() => navigate('/register-event')}
              className="action-button"
            >
              <i className="fas fa-plus"></i> Create Event
            </button>
          </div>
          
          {events.length > 0 ? (
            <div className="cards-grid">
              {events.map(event => (
                <div key={event.eventID} className="event-card" onClick={() => navigate(`/events/${event.eventID}`)}>
                  <div className="event-card-header">
                    {event.thumbnail ? (
                      <img src={formatImageUrl(event.thumbnail)} alt={event.title} />
                    ) : (
                      <div className="event-placeholder">{event.title.charAt(0)}</div>
                    )}
                  </div>
                  <div className="event-card-content">
                    <h3>{event.title}</h3>
                    <p className="event-date">
                      {new Date(event.startDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <i className="fas fa-calendar-alt"></i>
              <p>You haven't created any events yet</p>
              <button onClick={() => navigate('/register-event')}>Create Your First Event</button>
            </div>
          )}
        </div>
        
        <button className="logout-button" onClick={logout}>
          <i className="fas fa-sign-out-alt"></i> Log Out
        </button>
      </div>
    </div>
  );
}

export default Profile;