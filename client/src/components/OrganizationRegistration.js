import React, { useState, useEffect } from 'react';
import './OrganizationRegistration.css';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

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
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const orgFormData = new FormData();
      orgFormData.append('name', formData.name);
      orgFormData.append('description', formData.description);
      orgFormData.append('userID', currentUser.id);
      orgFormData.append('privacy', formData.privacy);
      orgFormData.append('submitForOfficialStatus', formData.submitForOfficialStatus);

      if (formData.thumbnail) {
        orgFormData.append('thumbnail', formData.thumbnail);
      }

      if (formData.banner) {
        orgFormData.append('banner', formData.banner);
      }

      const response = await fetch(`${API_URL}/api/register-organization`, {
        method: 'POST',
        body: orgFormData,
      });

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
        }, 3000);
      } else {
        setErrors({ form: data.error || 'Failed to create organization' });
      }
    } catch (error) {
      console.error('Error creating organization:', error);
      setErrors({ form: 'An unexpected error occurred. Please try again.' });
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
            <input
              type="file"
              name="thumbnail"
              onChange={handleChange}
            />
            {errors.thumbnail && <p className="error">{errors.thumbnail}</p>}
          </div>
          <div className="form-group">
            <label>Banner:</label>
            <input
              type="file"
              name="banner"
              onChange={handleChange}
            />
            {errors.banner && <p className="error">{errors.banner}</p>}
          </div>
          <div className="form-group">
            <label>Privacy:</label>
            <select
              name="privacy"
              value={formData.privacy}
              onChange={handleChange}
            >
              <option value="public">Public</option>
              <option value="private">Admin Invite Only</option>
            </select>
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