import React, { useState } from 'react';
import './OrganizationRegistration.css';

// Define the API URL using environment variables
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

  const handleChange = async (e) => {
    const { name, value, type, checked, files } = e.target;

    setFormData(prevFormData => ({
      ...prevFormData,
      [name]: type === 'checkbox' ? checked : type === 'file' ? files[0] : value,
    }));

    if (name === 'name') {
      // Check if the name already exists
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

    const submitData = new FormData();
    for (const key in formData) {
      submitData.append(key, formData[key]);
    }

    try {
      const response = await fetch(`${API_URL}/api/register-organization`, {
        method: 'POST',
        body: submitData,
      });

      const result = await response.json();
      if (result.success) {
        alert('Organization registered successfully!');
      } else {
        alert(`Organization registration failed: ${result.error}`);
      }
    } catch (error) {
      alert(`Organization registration failed: ${error.message}`);
    }
  };

  return (
    <div className="registration-container">
      <h2>Create Organization</h2>
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
        <button type="submit" className="submit-button">Register</button>
      </form>
    </div>
  );
}

export default OrganizationRegistration;