import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './OrganizationRegistration.css';

function OrganizationRegistration() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    privacy: 'public',
    thumbnail: null,
    banner: null
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);
  
  const API_URL = process.env.REACT_APP_API_URL || 'https://the-quad-worker.gren9484.workers.dev';
  
  // Redirect if not logged in
  useEffect(() => {
    if (!currentUser) {
      console.log("No user found, redirecting to login");
      navigate('/login');
      return;
    } else {
      console.log("Current user found:", currentUser);
    }
  }, [currentUser, navigate]);
  
  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Organization name is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'thumbnail' || name === 'banner') {
      setFormData(prev => ({
        ...prev,
        [name]: files[0]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    try {
      setIsSubmitting(true);
      setApiError(null);
      
      // Get auth token for the request
      const token = localStorage.getItem('token');
      if (!token) {
        console.error("No authentication token found");
        setApiError("You need to be logged in to create an organization");
        navigate('/login');
        return;
      }
      
      // Determine user ID from currentUser
      const userId = currentUser?.id || currentUser?.userID;
      if (!userId) {
        console.error("User ID not found in currentUser:", currentUser);
        setApiError("User ID could not be determined");
        return;
      }
      
      // Create form data for submission
      const submitData = new FormData();
      submitData.append('name', formData.name);
      submitData.append('description', formData.description);
      submitData.append('privacy', formData.privacy);
      submitData.append('userID', userId);
      
      if (formData.thumbnail) {
        submitData.append('thumbnail', formData.thumbnail);
      }
      
      if (formData.banner) {
        submitData.append('banner', formData.banner);
      }
      
      // Log the request data for debugging
      console.log("Organization registration request:", {
        name: formData.name,
        description: formData.description,
        privacy: formData.privacy,
        userID: userId,
        thumbnail: formData.thumbnail ? "File included" : "No file",
        banner: formData.banner ? "File included" : "No file"
      });
      
      const response = await fetch(`${API_URL}/api/register-organization`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}` // Add auth token to request
        },
        body: submitData
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Redirect to the new organization page
        console.log("Organization created successfully:", data);
        navigate(`/organizations/${data.orgID}`);
      } else {
        console.error("Organization creation failed:", data.error);
        setApiError(data.error || 'Failed to create organization');
      }
    } catch (error) {
      console.error('Error creating organization:', error);
      setApiError('An error occurred while creating the organization');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="org-page-container"></div>
      <div className="org-registration-wrapper">
        <div className="registration-container">
          <h2>Create Organization</h2>
          
          {apiError && (
            <div className="error-message">
              <p>{apiError}</p>
              <button 
                className="dismiss-button"
                onClick={() => setApiError(null)}
              >
                Dismiss
              </button>
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Organization Name:</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
              {errors.name && <p className="error">{errors.name}</p>}
            </div>
            
            <div className="form-group">
              <label>Description:</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="4"
              />
            </div>
            
            <div className="form-group">
              <label>Thumbnail Image:</label>
              <div className="custom-file-upload">
                <input
                  type="file"
                  name="thumbnail"
                  onChange={handleChange}
                  accept="image/*"
                />
                <div className="file-upload-btn">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 15v3H6v-3H4v3c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-3h-2zM7 9l1.41 1.41L11 7.83V16h2V7.83l2.59 2.58L17 9l-5-5-5 5z"/>
                  </svg>
                  Choose Thumbnail
                </div>
                {formData.thumbnail && (
                  <div className="file-name">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                    </svg>
                    {formData.thumbnail.name}
                  </div>
                )}
              </div>
            </div>
            
            <div className="form-group">
              <label>Banner Image:</label>
              <div className="custom-file-upload">
                <input
                  type="file"
                  name="banner"
                  onChange={handleChange}
                  accept="image/*"
                />
                <div className="file-upload-btn">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 15v3H6v-3H4v3c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-3h-2zM7 9l1.41 1.41L11 7.83V16h2V7.83l2.59 2.58L17 9l-5-5-5 5z"/>
                  </svg>
                  Choose Banner
                </div>
                {formData.banner && (
                  <div className="file-name">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                    </svg>
                    {formData.banner.name}
                  </div>
                )}
              </div>
            </div>
            
            <div className="form-group">
              <label>Privacy:</label>
              <div className="privacy-options">
                <div className="privacy-option">
                  <input
                    type="radio"
                    id="public"
                    name="privacy"
                    value="public"
                    checked={formData.privacy === 'public'}
                    onChange={handleChange}
                  />
                  <label htmlFor="public">
                    <span className="radio-circle"></span>
                    <div>
                      <span className="option-title">Public</span>
                      <span className="option-description">Anyone can see this organization</span>
                    </div>
                  </label>
                </div>
                
                <div className="privacy-option">
                  <input
                    type="radio"
                    id="private"
                    name="privacy"
                    value="private"
                    checked={formData.privacy === 'private'}
                    onChange={handleChange}
                  />
                  <label htmlFor="private">
                    <span className="radio-circle"></span>
                    <div>
                      <span className="option-title">Private</span>
                      <span className="option-description">Only members can see this organization</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
            
            <button 
              type="submit" 
              className="submit-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Organization'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

export default OrganizationRegistration;