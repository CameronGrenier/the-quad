import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './OrganizationRegistration.css';
import CustomSelect from './CustomSelect';

function OrganizationRegistration() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    privacy: 'public',
    thumbnail: null,
    banner: null,
    submitForOfficialStatus: false // Add this line
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
    const errors = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Organization name is required';
    }
    
    // If submitting for official status, require thumbnail and banner
    if (formData.submitForOfficialStatus) {
      if (!formData.thumbnail) {
        errors.thumbnail = 'Thumbnail is required for official status';
      }
      
      if (!formData.banner) {
        errors.banner = 'Banner is required for official status';
      }
    }
    
    setErrors(errors);
    return Object.keys(errors).length === 0; // Return true if no errors
  };
  
  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    
    if (type === 'file') {
      setFormData({
        ...formData,
        [name]: files[0] || null
      });
      
      // Clear file error if a file is selected
      if (files[0] && errors[name]) {
        setErrors({
          ...errors,
          [name]: null
        });
      }
    } else if (type === 'checkbox') {
      const newValue = checked;
      setFormData({
        ...formData,
        [name]: newValue
      });
      
      // If toggling submitForOfficialStatus, check if we need thumbnail and banner
      if (name === 'submitForOfficialStatus') {
        const newErrors = {};
        
        if (newValue) {
          if (!formData.thumbnail) {
            newErrors.thumbnail = 'Thumbnail is required for official status';
          }
          
          if (!formData.banner) {
            newErrors.banner = 'Banner is required for official status';
          }
        } else {
          // Clear thumbnail and banner errors if turning off official status
          if (errors.thumbnail) newErrors.thumbnail = null;
          if (errors.banner) newErrors.banner = null;
        }
        
        // Update errors if needed
        if (Object.keys(newErrors).length > 0) {
          setErrors({
            ...errors,
            ...newErrors
          });
        }
      }
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
      
      // Clear string field error if it's not empty
      if (value.trim() && errors[name]) {
        setErrors({
          ...errors,
          [name]: null
        });
      }
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate the form and only proceed if valid
    const isValid = validateForm();
    if (!isValid) return;
    
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
      submitData.append('submitForOfficialStatus', formData.submitForOfficialStatus); // Add this line
      
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
        banner: formData.banner ? "File included" : "No file",
        submitForOfficialStatus: formData.submitForOfficialStatus // Add this line
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
          
          <form 
            onSubmit={handleSubmit}
            className={formData.submitForOfficialStatus ? 'submitForOfficialStatus-checked' : ''}
          >
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
            
            <div className="form-group required-for-official">
              <label>
                Thumbnail Image:
                {formData.submitForOfficialStatus && <span className="required-field">*</span>}
              </label>
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
            
            <div className="form-group required-for-official">
              <label>
                Banner Image:
                {formData.submitForOfficialStatus && <span className="required-field">*</span>}
              </label>
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
            
            <button 
              type="submit" 
              className="submit-button"
              disabled={isSubmitting || (formData.submitForOfficialStatus && (!formData.thumbnail || !formData.banner))}
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