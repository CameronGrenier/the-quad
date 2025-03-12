import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import './EventRegistration.css';

// Define the API URL using environment variables
const API_URL = process.env.REACT_APP_API_URL || 'https://the-quad-worker.gren9484.workers.dev';

function EventRegistration() {
  const { currentUser } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [landmarks, setLandmarks] = useState([]);
  const [landmarkAvailable, setLandmarkAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    organizationID: '',
    title: '',
    description: '',
    thumbnail: null,
    banner: null,
    startDate: new Date(),
    endDate: new Date(new Date().getTime() + 2 * 60 * 60 * 1000), // Default to 2 hours later
    privacy: 'public',
    submitForOfficialStatus: false,
    landmarkID: '',
    customLocation: '',
  });
  
  const [errors, setErrors] = useState({});
  const [useCustomLocation, setUseCustomLocation] = useState(true);

  // Fetch user's organizations where they are an admin
  useEffect(() => {
    const fetchUserOrganizations = async () => {
      if (!currentUser) return;
      
      try {
        const response = await fetch(`${API_URL}/api/user-organizations?userID=${currentUser.userID}`);
        const data = await response.json();
        
        if (data.success) {
          setOrganizations(data.organizations);
          if (data.organizations.length > 0) {
            setFormData(prev => ({
              ...prev,
              organizationID: data.organizations[0].orgID
            }));
          }
        }
      } catch (error) {
        console.error('Error fetching organizations:', error);
      } finally {
        setLoading(false);
      }
    };
    
    // Fetch landmarks
    const fetchLandmarks = async () => {
      try {
        const response = await fetch(`${API_URL}/api/landmarks`);
        const data = await response.json();
        
        if (data.success) {
          setLandmarks(data.landmarks || []);
        }
      } catch (error) {
        console.error('Error fetching landmarks:', error);
      }
    };
    
    fetchUserOrganizations();
    fetchLandmarks();
  }, [currentUser]);

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    
    if (name === 'landmarkID' && value) {
      checkLandmarkAvailability(value, formData.startDate, formData.endDate);
    }

    setFormData(prevData => ({
      ...prevData,
      [name]: type === 'checkbox' ? checked : type === 'file' ? files[0] : value,
    }));
    
    // Clear errors when field is modified
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleDateChange = (date, field) => {
    setFormData(prev => ({
      ...prev,
      [field]: date
    }));
    
    // If landmark is selected, check availability when dates change
    if (formData.landmarkID && !useCustomLocation) {
      checkLandmarkAvailability(formData.landmarkID, 
        field === 'startDate' ? date : formData.startDate,
        field === 'endDate' ? date : formData.endDate);
    }
  };

  const checkLandmarkAvailability = async (landmarkID, startDate, endDate) => {
    try {
      const response = await fetch(`${API_URL}/api/check-landmark-availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          landmarkID,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        })
      });
      
      const data = await response.json();
      setLandmarkAvailable(data.available);
      
      if (!data.available) {
        setErrors(prev => ({
          ...prev,
          landmarkID: 'This landmark is not available during the selected time period'
        }));
      } else {
        setErrors(prev => ({
          ...prev,
          landmarkID: ''
        }));
      }
    } catch (error) {
      console.error('Error checking landmark availability:', error);
    }
  };

  const validateForm = () => {
    let tempErrors = {};
    
    // Required fields
    if (!formData.organizationID) {
      tempErrors.organizationID = 'Organization is required';
    }
    
    if (!formData.title.trim()) {
      tempErrors.title = 'Event title is required';
    }
    
    if (formData.startDate >= formData.endDate) {
      tempErrors.date = 'End time must be after start time';
    }
    
    // If not using custom location and no landmark selected
    if (!useCustomLocation && !formData.landmarkID) {
      tempErrors.landmarkID = 'Please select a landmark';
    }
    
    // If using custom location but no location provided
    if (useCustomLocation && !formData.customLocation.trim()) {
      tempErrors.customLocation = 'Location is required';
    }
    
    // If landmark is selected but not available
    if (!useCustomLocation && formData.landmarkID && !landmarkAvailable) {
      tempErrors.landmarkID = 'This landmark is not available during the selected time period';
    }
    
    // If submitting for official status
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
    
    // Add form fields to FormData
    submitData.append('organizationID', formData.organizationID);
    submitData.append('title', formData.title);
    submitData.append('description', formData.description);
    submitData.append('startDate', formData.startDate.toISOString());
    submitData.append('endDate', formData.endDate.toISOString());
    submitData.append('privacy', formData.privacy);
    submitData.append('submitForOfficialStatus', formData.submitForOfficialStatus);
    
    if (formData.thumbnail) {
      submitData.append('thumbnail', formData.thumbnail);
    }
    
    if (formData.banner) {
      submitData.append('banner', formData.banner);
    }
    
    // Add location data
    if (useCustomLocation) {
      submitData.append('customLocation', formData.customLocation);
      submitData.append('landmarkID', '');
    } else {
      submitData.append('landmarkID', formData.landmarkID);
      submitData.append('customLocation', '');
    }
    
    try {
      const response = await fetch(`${API_URL}/api/register-event`, {
        method: 'POST',
        body: submitData,
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('Event created successfully!');
        // Reset form or redirect
      } else {
        alert(`Failed to create event: ${result.error}`);
      }
    } catch (error) {
      alert(`Error creating event: ${error.message}`);
    }
  };

  if (loading) {
    return <div className="registration-container">Loading...</div>;
  }
  
  // Redirect if user is not logged in
  if (!currentUser) {
    return <div className="registration-container">
      <h2>Please log in to create an event</h2>
    </div>;
  }
  
  // Show message if user isn't an admin of any organization
  if (organizations.length === 0) {
    return (
      <>
        <div className="event-page-container"></div>
        <div className="registration-container">
          <h2>You need to be an administrator of an organization to create events</h2>
          <p className="message-text">Please create an organization first or ask to be added as an admin to an existing organization.</p>
          <div className="button-container">
            <a href="/register-organization" className="submit-button">
              Create Organization
            </a>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="event-page-container"></div>
      <div className="registration-container">
        <h2>Create Event</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Organization:</label>
            <select
              name="organizationID"
              value={formData.organizationID}
              onChange={handleChange}
              required
            >
              {organizations.map(org => (
                <option key={org.orgID} value={org.orgID}>{org.name}</option>
              ))}
            </select>
            {errors.organizationID && <p className="error">{errors.organizationID}</p>}
          </div>
          
          <div className="form-group">
            <label>Event Title:</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
            />
            {errors.title && <p className="error">{errors.title}</p>}
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
            <label>Thumbnail:</label>
            <input
              type="file"
              name="thumbnail"
              onChange={handleChange}
              accept="image/*"
            />
            {errors.thumbnail && <p className="error">{errors.thumbnail}</p>}
          </div>
          
          <div className="form-group">
            <label>Banner:</label>
            <input
              type="file"
              name="banner"
              onChange={handleChange}
              accept="image/*"
            />
            {errors.banner && <p className="error">{errors.banner}</p>}
          </div>
          
          <div className="form-group">
            <label>Start Date & Time:</label>
            <DatePicker
              selected={formData.startDate}
              onChange={(date) => handleDateChange(date, 'startDate')}
              showTimeSelect
              dateFormat="MMMM d, yyyy h:mm aa"
              className="datepicker-input" // Using specific class
              required
            />
          </div>
          
          <div className="form-group">
            <label>End Date & Time:</label>
            <DatePicker
              selected={formData.endDate}
              onChange={(date) => handleDateChange(date, 'endDate')}
              showTimeSelect
              timeFormat="HH:mm"
              timeIntervals={15}
              timeCaption="time"
              dateFormat="MMMM d, yyyy h:mm aa"
              className="date-picker"
              minDate={formData.startDate}
            />
            {errors.date && <p className="error">{errors.date}</p>}
          </div>
          
          <div className="form-group checkbox-group">
            <label>Location Type:</label>
            <div className="radio-options">
              <div className="radio-option">
                <input
                  type="radio"
                  id="customLocation"
                  name="locationType"
                  checked={useCustomLocation}
                  onChange={() => setUseCustomLocation(true)}
                />
                <label htmlFor="customLocation">Custom Location</label>
              </div>
              <div className="radio-option">
                <input
                  type="radio"
                  id="campusLocation"
                  name="locationType"
                  checked={!useCustomLocation}
                  onChange={() => setUseCustomLocation(false)}
                />
                <label htmlFor="campusLocation">Campus Landmark</label>
              </div>
            </div>
          </div>
          
          {useCustomLocation ? (
            <div className="form-group">
              <label>Location:</label>
              <input
                type="text"
                name="customLocation"
                value={formData.customLocation}
                onChange={handleChange}
                placeholder="Enter location details"
              />
              {errors.customLocation && <p className="error">{errors.customLocation}</p>}
            </div>
          ) : (
            <div className="form-group">
              <label>Select Landmark:</label>
              <select
                name="landmarkID"
                value={formData.landmarkID}
                onChange={handleChange}
              >
                <option value="">-- Select a landmark --</option>
                {landmarks.map(landmark => (
                  <option key={landmark.landmarkID} value={landmark.landmarkID}>
                    {landmark.name}
                  </option>
                ))}
              </select>
              {!landmarkAvailable && (
                <p className="error">This landmark is not available during the selected time.</p>
              )}
              {errors.landmarkID && <p className="error">{errors.landmarkID}</p>}
            </div>
          )}
          
          <div className="form-group">
            <label>Privacy:</label>
            <select
              name="privacy"
              value={formData.privacy}
              onChange={handleChange}
            >
              <option value="public">Public - Anyone can view and join</option>
              <option value="organization">Organization - Only members can view and join</option>
              <option value="private">Private - Invitation only</option>
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
          
          <button type="submit" className="submit-button">Create Event</button>
        </form>
      </div>
    </>
  );
}

export default EventRegistration;
