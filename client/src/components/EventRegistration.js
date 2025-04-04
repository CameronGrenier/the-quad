import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom'; // Add this import
import DatePicker from 'react-datepicker';
import { useAuth } from '../context/AuthContext';
import 'react-datepicker/dist/react-datepicker.css';
import './EventRegistration.css';
import CustomSelect from './CustomSelect';
import LocationMap from './LocationMap';
import { API_URL } from '../config/constants';

function EventRegistration() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [landmarks, setLandmarks] = useState([]);
  const [landmarkAvailable, setLandmarkAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [showSuccessPopup, setShowSuccessPopup] = useState(false); 
  
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
    customLocationData: null,
    locationType: 'landmark', 
  });
  
  const [errors, setErrors] = useState({});
  const [useCustomLocation, setUseCustomLocation] = useState(true);

  const locationSearchRef = useRef(null);

  const [landmarkAvailability, setLandmarkAvailability] = useState(null);

  const handleLandmarkChange = async (e) => {
    const landmarkID = e.target.value;
    
    // Update form data
    const updatedFormData = {
      ...formData,
      landmarkID: landmarkID
    };
    setFormData(updatedFormData);
    
    // Check availability if landmark is selected and we have dates
    if (landmarkID && formData.startDate && formData.endDate) {
      const availability = await checkLandmarkAvailability(landmarkID);
      setLandmarkAvailability(availability);
    } else {
      setLandmarkAvailability(null);
    }
  };

  // Update the useEffect to set loading to false properly
  useEffect(() => {
    // Redirect if not logged in
    if (!currentUser) {
      navigate('/login');
      return;
    }

    let organizationsLoaded = false;
    let landmarksLoaded = false;
    
    // Function to check if all data is loaded
    const checkAllLoaded = () => {
      if (organizationsLoaded && landmarksLoaded) {
        setLoading(false);
      }
    };

    // Only fetch organizations if we have a valid user ID
    async function fetchUserOrganizations() {
      // Get the user ID using both possible field names
      const userId = currentUser?.id || currentUser?.userID;
      
      if (!userId) {
        console.log("No user ID available, skipping organization fetch");
        organizationsLoaded = true;
        checkAllLoaded();
        return;
      }
      
      try {
        // Use the correct user ID in the API call
        const response = await fetch(`${API_URL}/api/user-organizations?userID=${userId}`);
        
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          console.log("Organizations fetched:", data.organizations);
          setOrganizations(data.organizations);
          
          // Only set first org if organizations exist
          if (data.organizations && data.organizations.length > 0) {
            // Get the organization ID using the right property
            const firstOrgId = data.organizations[0].orgID || data.organizations[0].id;
            setFormData(prev => ({
              ...prev,
              organizationID: firstOrgId
            }));
          }
        } else {
          console.log("API returned success: false");
          setOrganizations([]);
        }
      } catch (error) {
        console.error('Error fetching user organizations:', error);
        setApiError('Unable to load your organizations. Please try again later.');
        setOrganizations([]);
      } finally {
        organizationsLoaded = true;
        checkAllLoaded();
      }
    }

    // Fix landmarks fetch with proper error handling
    async function fetchLandmarks() {
      try {
        const response = await fetch(`${API_URL}/api/landmarks`);
        
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          setLandmarks(data.landmarks);
        }
      } catch (error) {
        console.error('Error fetching landmarks:', error);
        // No need to display error for landmarks as it's not critical
        setLandmarks([]);
      } finally {
        landmarksLoaded = true;
        checkAllLoaded();
      }
    }

    fetchUserOrganizations();
    fetchLandmarks();
  }, [currentUser, navigate]);

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

  const handleDateChange = async (date, field) => {
    const updatedFormData = {
      ...formData,
      [field]: date
    };
    setFormData(updatedFormData);
    
    // Check landmark availability when dates change
    if (updatedFormData.landmarkID && updatedFormData.startDate && updatedFormData.endDate) {
      const availability = await checkLandmarkAvailability(updatedFormData.landmarkID);
      setLandmarkAvailability(availability);
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

  // Add a handler for location selection from the map
  const handleLocationSelect = (locationData) => {
    setFormData(prev => ({
      ...prev,
      customLocation: locationData.address, // Use the full address here
      customLocationData: locationData
    }));
    
    // Clear any location errors when a new location is selected
    if (errors.customLocation) {
      setErrors(prev => ({ ...prev, customLocation: '' }));
    }
  };

  // Form validation function
  const validateForm = () => {
    let tempErrors = {};
    
    // Required fields
    if (!formData.organizationID || formData.organizationID === '') {
      tempErrors.organizationID = 'Organization is required';
    }
    
    if (!formData.title.trim()) {
      tempErrors.title = 'Event title is required';
    }
    
    if (formData.startDate >= formData.endDate) {
      tempErrors.date = 'End time must be after start time';
    }
    
    // Location validation based on location type
    if (formData.locationType === 'landmark') {
      if (!formData.landmarkID) {
        tempErrors.landmarkID = 'Please select a landmark';
      }
      
      // If landmark is selected but not available
      if (formData.landmarkID && !landmarkAvailable) {
        tempErrors.landmarkID = 'This landmark is not available during the selected time period';
      }
    } else if (formData.locationType === 'custom') {
      if (!formData.customLocation.trim()) {
        tempErrors.customLocation = 'Location is required';
      }
    }
    
    // Check for official status requirements
    if (formData.submitForOfficialStatus) {
      if (!formData.thumbnail) {
        tempErrors.thumbnail = 'Thumbnail is required for official status';
      }
      if (!formData.banner) {
        tempErrors.banner = 'Banner is required for official status';
      }
    }
    
    console.log("Validation errors:", tempErrors);
    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    
    if (name === 'organizationID') {
      console.log("Organization selected:", value);
      // Make sure it's stored as a number if it's not empty
      const parsedValue = value !== '' ? parseInt(value, 10) : '';
      setFormData({
        ...formData,
        [name]: parsedValue
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
    
    // Clear errors when field is updated
    setErrors({
      ...errors,
      [name]: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const submitData = new FormData();
      
      // Add basic event data
      submitData.append('organizationID', formData.organizationID);
      submitData.append('title', formData.title);
      submitData.append('description', formData.description);
      submitData.append('startDate', formData.startDate.toISOString());
      submitData.append('endDate', formData.endDate.toISOString());
      submitData.append('privacy', formData.privacy);
      submitData.append('submitForOfficialStatus', formData.submitForOfficialStatus);
      
      // Include the current user's ID (checking both property names)
      submitData.append('userID', currentUser.id || currentUser.userID);
      
      // Add thumbnail if provided
      if (formData.thumbnail) {
        submitData.append('thumbnail', formData.thumbnail);
      }
      
      // Add banner if provided
      if (formData.banner) {
        submitData.append('banner', formData.banner);
      }
      
      // Update the location data submission
      if (formData.locationType === 'landmark') {
        submitData.append('landmarkID', formData.landmarkID);
        submitData.append('customLocation', '');
        submitData.append('locationType', 'landmark');
      } else {
        submitData.append('landmarkID', '');
        submitData.append('customLocation', formData.customLocation);
        submitData.append('locationType', 'custom');
        
        // Add detailed location data if available
        if (formData.customLocationData) {
          submitData.append('locationAddress', formData.customLocationData.address);
          submitData.append('locationLatitude', formData.customLocationData.coordinates.lat);
          submitData.append('locationLongitude', formData.customLocationData.coordinates.lng);
        }
      }
      
      // Submit the form
      const response = await fetch(`${API_URL}/api/register-event`, {
        method: 'POST',
        body: submitData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
      });
      
      const result = await response.json();
      
      if (result.success) {
        setShowSuccessPopup(true); // Show success popup
        setTimeout(() => {
          setShowSuccessPopup(false);
          navigate('/'); // Redirect to homepage or events page
        }, 3000); // Hide popup after 3 seconds
      } else {
        setApiError(`Failed to create event: ${result.error}`);
      }
    } catch (error) {
      console.error('Error creating event:', error);
      setApiError(`An unexpected error occurred: ${error.message}`);
    } finally {
      setIsSubmitting(false);
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
        
        {/* Success popup */}
        {showSuccessPopup && (
          <div className="success-popup">
            <div className="success-content">
              <div className="success-icon">✓</div>
              <h3>Event Created!</h3>
              <p>Your event has been created successfully.</p>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Organization:</label>
            <CustomSelect
              name="organizationID"
              value={formData.organizationID}
              onChange={handleChange}
              options={organizations.map(org => ({
                value: org.orgID || org.id,
                label: org.name
              }))}
              placeholder="Select an organization"
            />
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
                id="thumbnail"
                className="file-input"
              />
              <label htmlFor="thumbnail" className="file-label">
                <i className="fas fa-upload"></i> Choose Thumbnail
              </label>
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
                id="banner"
                className="file-input"
              />
              <label htmlFor="banner" className="file-label">
                <i className="fas fa-upload"></i> Choose Banner
              </label>
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
          
          {/* Location type selection - simplified with just Landmark and Custom options */}
          <div className="form-group">
            <label>Location Type:</label>
            <div className="location-type-container">
              <div className="location-type-button">
                <input 
                  type="radio" 
                  id="landmark" 
                  name="locationType" 
                  value="landmark"
                  checked={formData.locationType === 'landmark'}
                  onChange={handleChange}
                />
                <label htmlFor="landmark">
                  <span className="location-type-text">Campus Landmark</span>
                </label>
              </div>
              
              <div className="location-type-button">
                <input 
                  type="radio" 
                  id="custom" 
                  name="locationType" 
                  value="custom"
                  checked={formData.locationType === 'custom'}
                  onChange={handleChange}
                />
                <label htmlFor="custom">
                  <span className="location-type-text">Custom Location</span>
                </label>
              </div>
            </div>
          </div>
          
          {/* Conditional rendering based on location type selection */}
          {formData.locationType === 'landmark' ? (
            <div className="form-group">
              <label>Select Landmark:</label>
              <CustomSelect
                name="landmarkID"
                value={formData.landmarkID}
                onChange={handleChange}
                options={landmarks.map(landmark => ({
                  value: landmark.id || landmark.landmarkID,
                  label: landmark.name
                }))}
                placeholder="Select a campus location"
              />
              {landmarks.length === 0 && (
                <p className="info-message">No campus landmarks are currently available. Please use a custom location.</p>
              )}
              {!landmarkAvailable && (
                <p className="error">This landmark is not available during the selected time.</p>
              )}
              {errors.landmarkID && <p className="error">{errors.landmarkID}</p>}
            </div>
          ) : (
            <div className="form-group">
              <label>Location:</label>
              <div className="location-search-container">
                <input
                  ref={locationSearchRef}
                  type="text"
                  name="customLocation"
                  value={formData.customLocation}
                  onChange={handleChange}
                  placeholder="Search for or enter a location"
                  className="form-input location-search-input"
                />
              </div>
              <LocationMap 
                onLocationSelect={handleLocationSelect} 
                initialLocation={formData.customLocationData?.coordinates}
                searchInputRef={locationSearchRef}
              />
              {errors.customLocation && <p className="error">{errors.customLocation}</p>}
            </div>
          )}
          
          <div className="form-group">
            <label>Privacy:</label>
            <CustomSelect
              name="privacy"
              value={formData.privacy}
              onChange={handleChange}
              options={[
                { value: 'public', label: 'Public' },
                { value: 'organization', label: 'Organization' },
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
            {isSubmitting ? 'Creating...' : 'Create Event'}
          </button>
        </form>
      </div>
    </>
  );
}

export default EventRegistration;
