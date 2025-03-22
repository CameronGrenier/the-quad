import React, { useState, useEffect } from 'react';
import './OrganizationRegistration.css';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import CustomSelect from './CustomSelect';

const API_URL = process.env.REACT_APP_API_URL || 'https://the-quad-worker.gren9484.workers.dev';

function OrganizationRegistration() {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    thumbnail: null,
    banner: null,
    privacy: 'public',
    submitForOfficialStatus: false,
  });
  const [errors, setErrors] = useState({});
  const [nameExistsError, setNameExistsError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  // Redirect to login if user is not authenticated
  useEffect(() => {
    if (!currentUser) {
      navigate('/login', { state: { from: '/register-organization', message: 'You need to log in to create an organization.' } });
    }
  }, [currentUser, navigate]);

  // Add this debug effect to log user data
  useEffect(() => {
    console.log("OrganizationRegistration: Current user state:", currentUser ? {
      hasUser: !!currentUser,
      id: currentUser.id,
      userID: currentUser.userID, // Check if it might be stored under a different property name
      email: currentUser.email
    } : "No user");
    
    // If we have a user but no ID, try to read from localStorage directly
    if (currentUser && !currentUser.id) {
      try {
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          const parsedUser = JSON.parse(savedUser);
          console.log("Parsed user from localStorage:", {
            id: parsedUser.id,
            userID: parsedUser.userID,
            email: parsedUser.email
          });
        } else {
          console.log("No user data in localStorage");
        }
      } catch (error) {
        console.error("Error checking localStorage:", error);
      }
    }
  }, [currentUser]);

  const handleChange = async (e) => {
    const { name, value, type, checked, files } = e.target;

    setFormData(prevFormData => ({
      ...prevFormData,
      [name]: type === 'checkbox' ? checked : type === 'file' ? files[0] : value,
    }));

    if (name === 'name') {
      try {
        const response = await fetch(`${API_URL}/api/check-organization-name?name=${value}`, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        const result = await response.json();
        if (result.exists) {
          setNameExistsError('This organization name already exists.');
        } else {
          setNameExistsError('');
        }
      } catch (error) {
        console.error('Error checking organization name:', error);
        setNameExistsError('Error checking name. Please try again.');
      }
    }
  };

  const validateForm = () => {
    let tempErrors = {};
    
    // Check if user is logged in
    if (!currentUser || !currentUser.id) {
      tempErrors.form = 'You must be logged in to create an organization';
      // Redirect to login
      navigate('/login', { state: { from: '/register-organization' } });
      return false;
    }
    
    if (!formData.name) {
      tempErrors.name = 'Name is required';
    }
    if (formData.submitForOfficialStatus) {
      if (!formData.thumbnail) {
        tempErrors.thumbnail = 'Thumbnail is required for official status';
      }
      if (!formData.banner) {
        tempErrors.banner = 'Banner is required for official status';
      }
    }
    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check user before validation
    if (!currentUser) {
      setErrors({ form: "You must be logged in to create an organization" });
      navigate('/login', { state: { from: '/register-organization' } });
      return;
    }
    
    // Try to find any valid user ID
    const userId = currentUser.id || currentUser.userID;
    
    if (!userId) {
      console.error("No user ID available, clearing session and redirecting");
      // Session is probably broken, clear it and redirect
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setErrors({ form: "Your session is invalid. Please log in again." });
      navigate('/login', { state: { from: '/register-organization' } });
      return;
    }
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const orgFormData = new FormData();
      orgFormData.append('name', formData.name);
      orgFormData.append('description', formData.description);
      orgFormData.append('userID', userId);
      orgFormData.append('privacy', formData.privacy);
      
      console.log("Submitting organization form with user ID:", userId);

      if (formData.thumbnail) {
        orgFormData.append('thumbnail', formData.thumbnail);
        console.log("Including thumbnail:", formData.thumbnail.name);
      }

      if (formData.banner) {
        orgFormData.append('banner', formData.banner);
        console.log("Including banner:", formData.banner.name);
      }

      const response = await fetch(`${API_URL}/api/register-organization`, {
        method: 'POST',
        body: orgFormData,
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        
        if (contentType && contentType.includes("application/json")) {
          // Parse JSON error response
          const data = await response.json();
          console.error('API Error:', data);
          setErrors({ form: `Error: ${data.error || 'Unknown server error'}` });
        } else {
          // Handle non-JSON error response
          const text = await response.text();
          console.error('API Error (non-JSON):', text);
          setErrors({ form: `Server error: ${response.status} ${response.statusText}` });
        }
        return;
      }

      const data = await response.json();

      if (data.success) {
        setShowSuccessPopup(true);
        setFormData({
          name: '',
          description: '',
          thumbnail: null,
          banner: null,
          privacy: 'public',
          submitForOfficialStatus: false
        });
        setErrors({});
        setNameExistsError('');
        setTimeout(() => {
          setShowSuccessPopup(false);
          navigate('/profile'); // Redirect to profile after success
        }, 3000);
      } else {
        // Enhanced error display with full error message
        console.error('API Error:', data.error);
        setErrors({ form: `Failed to create organization: ${data.error}` });
      }
    } catch (error) {
      console.error('Error creating organization:', error);
      setErrors({ form: `An unexpected error occurred: ${error.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="org-page-container"></div>
      <div className="registration-container">
        <h2>Create Organization</h2>

        {errors.form && <div className="error-message">{errors.form}</div>}

        {showSuccessPopup && (
          <div className="success-popup">
            <div className="success-content">
              <div className="success-icon">✓</div>
              <h3>Organization Created!</h3>
              <p>Your organization has been created successfully.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name:</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
            {errors.name && <p className="error">{errors.name}</p>}
            {nameExistsError && <p className="error">{nameExistsError}</p>}
          </div>
          <div className="form-group">
            <label>Description:</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label>Thumbnail:</label>
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
            {errors.thumbnail && <p className="error">{errors.thumbnail}</p>}
          </div>
          <div className="form-group">
            <label>Banner:</label>
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
            {errors.banner && <p className="error">{errors.banner}</p>}
          </div>
          <div className="form-group">
            <label>Privacy:</label>
            <CustomSelect
              name="privacy"
              value={formData.privacy}
              onChange={handleChange}
              options={[
                { value: 'public', label: 'Public' },
                { value: 'private', label: 'Private' }
              ]}
            />
          </div>
          <div className="form-group checkbox-group">
            <label htmlFor="submitForOfficialStatus">Submit for Official Status</label>
            <input
              type="checkbox"
              id="submitForOfficialStatus"
              name="submitForOfficialStatus"
              checked={formData.submitForOfficialStatus}
              onChange={handleChange}
            />
          </div>
          <button type="submit" className="submit-button" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Organization'}
          </button>
        </form>
      </div>
    </>
  );
}

export default OrganizationRegistration;