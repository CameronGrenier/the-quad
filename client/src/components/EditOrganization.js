import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './EditOrganization.css';
import CustomSelect from './CustomSelect';
import MarkdownRenderer from './MarkdownRenderer';
import ImageLoader from './ImageLoader';

function EditOrganization() {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const API_URL = process.env.REACT_APP_API_URL || 'https://the-quad-worker.gren9484.workers.dev';
  
  // Organization data
  const [organization, setOrganization] = useState(null);
  const [members, setMembers] = useState([]);
  const [admins, setAdmins] = useState([]);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    privacy: 'public',
    thumbnail: null,
    banner: null
  });
  
  // Preview images
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  
  // Admin management
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [eventAdminEnabled, setEventAdminEnabled] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [memberFetchError, setMemberFetchError] = useState(false);
  
  // Member management
  const [removingMemberId, setRemovingMemberId] = useState(null);
  const [removingAdminId, setRemovingAdminId] = useState(null);

  // Format image URLs - keep this inside the component
  const formatImageUrl = (url) => {
    if (!url) return null;
    
    if (url === '') return null;
    
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    if (url.startsWith('/images/')) {
      const pathSegments = url.substring(8).split('/');
      const encodedPath = pathSegments
        .map(segment => encodeURIComponent(segment))
        .join('/');
      return `${API_URL}/images/${encodedPath}`;
    }
    
    return `${API_URL}/images/${encodeURIComponent(url)}`;
  };

  // Function to fetch organization members - moved inside component
  const fetchMembers = async (orgId) => {
    try {
      console.log("Fetching members for organization:", orgId);
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Log the request details
      console.log(`Making request to ${API_URL}/api/organizations/${orgId}/members with token: ${token.substring(0, 15)}...`);
      
      const response = await fetch(`${API_URL}/api/organizations/${orgId}/members`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log("Response status:", response.status);
      
      if (!response.ok) {
        let errorText;
        try {
          // Try to get response body for better debugging
          const errorBody = await response.text();
          console.error("Error response body:", errorBody);
          errorText = errorBody;
        } catch (e) {
          errorText = "Could not extract error details";
        }
        throw new Error(`Failed to fetch members: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("Members data:", JSON.stringify(data));
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch members');
      }

      return data.members;
    } catch (error) {
      console.error("Error fetching members:", error);
      setMemberFetchError(true);
      // Fall back to alternative method
      return fetchAlternativeMembersList(orgId);
    }
  };

  // Fallback method to get members - moved inside component
  const fetchAlternativeMembersList = async (orgId) => {
    console.log("Using fallback method to get members");
    try {
      const token = localStorage.getItem('token');
      
      const orgResponse = await fetch(`${API_URL}/api/organizations/${orgId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!orgResponse.ok) {
        return [];
      }
      
      const orgData = await orgResponse.json();
      if (!orgData.success || !orgData.organization || !orgData.organization.admins) {
        return [];
      }
      
      // Use admins as a fallback member list
      const adminList = orgData.organization.admins;
      console.log(`Found ${adminList.length} admins to use as fallback members`);
      return adminList;
    } catch (error) {
      console.error("Error in fallback member fetch:", error);
      return [];
    }
  };

  // Function to fetch organization data - moved inside component
  const fetchOrganizationData = async () => {
    try {
      setLoading(true); // Now accessible since we're inside the component
      setError(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required. Please log in.');
        navigate('/login');
        return;
      }
      
      // Fetch organization details
      const orgResponse = await fetch(`${API_URL}/api/organizations/${orgId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!orgResponse.ok) {
        throw new Error(`Failed to fetch organization: ${orgResponse.status}`);
      }
      
      const orgData = await orgResponse.json();
      if (!orgData.success) {
        throw new Error(orgData.error || 'Failed to fetch organization');
      }
      
      const organization = orgData.organization;
      setOrganization(organization);
      
      // Set initial form data
      setFormData({
        name: organization.name || '',
        description: organization.description || '',
        privacy: organization.privacy || 'public',
        thumbnail: null,
        banner: null
      });
      
      // Set preview images if available
      if (organization.thumbnail) {
        setThumbnailPreview(formatImageUrl(organization.thumbnail));
      }
      
      if (organization.banner) {
        setBannerPreview(formatImageUrl(organization.banner));
      }
      
      // Fetch members with proper authentication
      try {
        const membersList = await fetchMembers(orgId);
        setMembers(membersList);
      } catch (memberError) {
        console.error("Members API not available, trying alternative method", memberError);
        const fallbackMembers = await fetchAlternativeMembersList(orgId);
        setMembers(fallbackMembers);
      }
      
      // Extract admins from the organization data
      if (organization.admins) {
        setAdmins(organization.admins);
      }
      
    } catch (error) {
      console.error('Error fetching organization:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Check if user is admin and load organization data
  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    
    fetchOrganizationData();
  }, [orgId, currentUser, navigate]);
  
  useEffect(() => {
    updateAvailableMembers();
  }, [members, admins]);

  // Update available members
  const updateAvailableMembers = () => {
    // Filter out members who are already admins
    const adminIds = admins.map(admin => admin.id || admin.userID);
    const available = members.filter(member => 
      !adminIds.includes(member.userID) && !adminIds.includes(member.id)
    );
    setAvailableMembers(available);
  };

  // Form change handlers
  const handleChange = (e) => {
    const { name, value, files } = e.target;
    
    if (files) {
      setFormData(prev => ({
        ...prev,
        [name]: files[0]
      }));
      
      // Create preview for images
      if (name === 'thumbnail' || name === 'banner') {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (name === 'thumbnail') {
            setThumbnailPreview(reader.result);
          } else {
            setBannerPreview(reader.result);
          }
        };
        reader.readAsDataURL(files[0]);
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };
  
  // Form submission handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      // Create form data for submission
      const submitData = new FormData();
      submitData.append('name', formData.name);
      submitData.append('description', formData.description);
      submitData.append('privacy', formData.privacy);
      
      if (formData.thumbnail) {
        submitData.append('thumbnail', formData.thumbnail);
      }
      
      if (formData.banner) {
        submitData.append('banner', formData.banner);
      }
      
      // Update organization details
      const response = await fetch(`${API_URL}/api/organizations/${orgId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: submitData
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to update organization');
      }
      
      setSuccessMessage('Organization updated successfully');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
      
    } catch (error) {
      console.error('Error updating organization:', error);
      setError(error.message);
    } finally {
      setSaving(false);
    }
  };
  
  // Member removal handler
  const handleRemoveMember = async (memberId) => {
    try {
      setRemovingMemberId(memberId);
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      const response = await fetch(`${API_URL}/api/organizations/${orgId}/members/${memberId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to remove member');
      }
      
      // Update members list
      setMembers(members.filter(member => member.userID !== memberId));
      setSuccessMessage('Member removed successfully');
      
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
      
    } catch (error) {
      console.error('Error removing member:', error);
      setError(error.message);
    } finally {
      setRemovingMemberId(null);
    }
  };
  
  // Admin removal handler
  const handleRemoveAdmin = async (adminId) => {
    try {
      setRemovingAdminId(adminId);
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      const response = await fetch(`${API_URL}/api/organizations/${orgId}/admins/${adminId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to remove admin');
      }
      
      // Update admins list
      setAdmins(admins.filter(admin => (admin.id !== adminId && admin.userID !== adminId)));
      setSuccessMessage('Admin removed successfully');
      
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
      
    } catch (error) {
      console.error('Error removing admin:', error);
      setError(error.message);
    } finally {
      setRemovingAdminId(null);
    }
  };
  
  // Add admin handler
  const handleAddAdmin = async (e) => {
    e.preventDefault();
    
    // Check if either email or selection is provided
    if (memberFetchError && !newAdminEmail) {
      setError('Please enter an email address');
      return;
    }
    
    if (!memberFetchError && selectedMembers.length === 0) {
      setError('Please select at least one member to add as admin');
      return;
    }
    
    try {
      setAddingAdmin(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      if (memberFetchError) {
        // Email-based addition
        const response = await fetch(`${API_URL}/api/organizations/${orgId}/admins`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            email: newAdminEmail,
            eventAdmin: eventAdminEnabled
          })
        });
        
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to add admin');
        }
        
        // Update admins list if new admin was returned
        if (data.admin) {
          setAdmins([...admins, data.admin]);
        } else {
          // Reload organization data to refresh admins
          await fetchOrganizationData();
        }
        
        setSuccessMessage('Admin added successfully');
        setNewAdminEmail('');
      } else {
        // Selection-based addition (multiple members)
        const addedAdmins = [];
        const errors = [];
        
        for (const memberId of selectedMembers) {
          try {
            const member = members.find(m => (m.userID || m.id) === memberId);
            
            const response = await fetch(`${API_URL}/api/organizations/${orgId}/admins`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ 
                email: member.email,
                eventAdmin: eventAdminEnabled
              })
            });
            
            const data = await response.json();
            if (data.success) {
              if (data.admin) {
                addedAdmins.push(data.admin);
              }
            } else {
              errors.push(`Failed to add ${member.firstName} ${member.lastName}: ${data.error}`);
            }
          } catch (memberError) {
            errors.push(`Error adding member: ${memberError.message}`);
          }
        }
        
        // Update UI
        if (addedAdmins.length > 0) {
          setAdmins([...admins, ...addedAdmins]);
          updateAvailableMembers();
          setSelectedMembers([]);
          
          setSuccessMessage(`${addedAdmins.length} administrator${addedAdmins.length !== 1 ? 's' : ''} added successfully`);
        }
        
        if (errors.length > 0) {
          setError(errors.join('\n'));
        }
      }
      
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
      
    } catch (error) {
      console.error('Error adding admin:', error);
      setError(error.message);
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleMemberSelection = (memberId) => {
    setSelectedMembers(prev => {
      if (prev.includes(memberId)) {
        return prev.filter(id => id !== memberId);
      } else {
        return [...prev, memberId];
      }
    });
  };
  
  if (loading) {
    return (
      <div className="edit-org-page">
        <div className="edit-org-container">
          <div className="loading-spinner"></div>
          <p>Loading organization data...</p>
        </div>
      </div>
    );
  }
  
  if (error && !organization) {
    return (
      <div className="edit-org-page">
        <div className="edit-org-container error-container">
          <h2>Error</h2>
          <p>{error}</p>
          <Link to={`/organizations/${orgId}`} className="button">
            Back to Organization
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="edit-org-page">
      <div className="edit-org-container">
        <div className="edit-org-header">
          <h1>Edit Organization</h1>
          <Link to={`/organizations/${orgId}`} className="view-org-link">
            <i className="fas fa-arrow-left"></i> Back to Organization
          </Link>
        </div>
        
        {successMessage && (
          <div className="success-message">
            <i className="fas fa-check-circle"></i> {successMessage}
          </div>
        )}
        
        {error && (
          <div className="error-message">
            <i className="fas fa-exclamation-circle"></i> {error}
            <button className="dismiss-error" onClick={() => setError(null)}>
              <i className="fas fa-times"></i>
            </button>
          </div>
        )}
        
        <div className="edit-tabs">
          <button 
            className={activeTab === 'details' ? 'active' : ''} 
            onClick={() => setActiveTab('details')}
          >
            Organization Details
          </button>
          <button 
            className={activeTab === 'members' ? 'active' : ''} 
            onClick={() => setActiveTab('members')}
          >
            Members ({members.length})
          </button>
          <button 
            className={activeTab === 'admins' ? 'active' : ''} 
            onClick={() => setActiveTab('admins')}
          >
            Administrators ({admins.length})
          </button>
        </div>
        
        <div className="tab-content">
          {/* Organization Details Tab */}
          {activeTab === 'details' && (
            <form onSubmit={handleSubmit} className="edit-org-form">
              <div className="form-group">
                <label>Organization Name:</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Description:</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="8"
                />
                <div className="description-preview">
                  <h4>Preview:</h4>
                  <div className="preview-content">
                    {formData.description ? (
                      <MarkdownRenderer content={formData.description} />
                    ) : (
                      <p className="no-description">No description provided.</p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="form-group">
                <label>Privacy:</label>
                <CustomSelect
                  name="privacy"
                  value={formData.privacy}
                  onChange={handleChange}
                  options={[
                    { value: 'public', label: 'Public - Anyone can see this organization' },
                    { value: 'private', label: 'Private - Only members can see this organization' }
                  ]}
                />
              </div>
              
              <div className="form-group">
                <label>Thumbnail Image:</label>
                <div className="image-upload-container">
                  {thumbnailPreview && (
                    <div className="image-preview thumbnail-preview">
                      <img src={thumbnailPreview} alt="Thumbnail preview" />
                    </div>
                  )}
                  <div className="custom-file-upload">
                    <input
                      type="file"
                      name="thumbnail"
                      onChange={handleChange}
                      accept="image/*"
                    />
                    <div className="file-upload-btn">
                      <i className="fas fa-upload"></i>
                      {thumbnailPreview ? 'Change Thumbnail' : 'Upload Thumbnail'}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="form-group">
                <label>Banner Image:</label>
                <div className="image-upload-container">
                  {bannerPreview && (
                    <div className="image-preview banner-preview">
                      <img src={bannerPreview} alt="Banner preview" />
                    </div>
                  )}
                  <div className="custom-file-upload">
                    <input
                      type="file"
                      name="banner"
                      onChange={handleChange}
                      accept="image/*"
                    />
                    <div className="file-upload-btn">
                      <i className="fas fa-upload"></i>
                      {bannerPreview ? 'Change Banner' : 'Upload Banner'}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="form-actions">
                <button 
                  type="submit" 
                  className="save-button"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="spinner"></span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-save"></i>
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
          
          {/* Members Tab */}
          {activeTab === 'members' && (
            <div className="members-tab">
              <h2>Organization Members</h2>
              {members.length === 0 ? (
                <p className="no-items">No members in this organization yet.</p>
              ) : (
                <div className="members-list">
                  {members.map(member => (
                    <div key={member.userID || member.id} className="member-item">
                      <div className="member-info">
                        <div className="member-avatar">
                          {member.profileImage ? (
                            <ImageLoader 
                              src={formatImageUrl(member.profileImage)} 
                              alt={`${member.firstName} ${member.lastName}`} 
                            />
                          ) : (
                            <div className="avatar-placeholder">
                              {member.firstName ? member.firstName.charAt(0) : '?'}
                            </div>
                          )}
                        </div>
                        <div className="member-details">
                          <h3>{member.firstName} {member.lastName}</h3>
                          <p className="member-email">{member.email}</p>
                        </div>
                      </div>
                      <button 
                        className="remove-button"
                        onClick={() => handleRemoveMember(member.userID)}
                        disabled={removingMemberId === member.userID}
                      >
                        {removingMemberId === member.userID ? (
                          <span className="spinner small"></span>
                        ) : (
                          <i className="fas fa-times"></i>
                        )}
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Admins Tab */}
          {activeTab === 'admins' && (
            <div className="admins-tab">
              <h2>Organization Administrators</h2>
              
              {admins.length === 0 ? (
                <p className="no-items">No administrators defined.</p>
              ) : (
                <div className="admins-list">
                  {admins.map(admin => {
                    const adminId = admin.id || admin.userID;
                    const isCurrentUser = adminId === (currentUser?.id || currentUser?.userID);
                    return (
                      <div key={adminId} className="admin-item">
                        <div className="admin-info">
                          <div className="admin-avatar">
                            {admin.profileImage ? (
                              <ImageLoader 
                                src={admin.profileImage} 
                                alt={`${admin.firstName} ${admin.lastName}`} 
                              />
                            ) : (
                              <div className="avatar-placeholder">
                                {admin.firstName ? admin.firstName.charAt(0) : (
                                  admin.f_name ? admin.f_name.charAt(0) : '?'
                                )}
                              </div>
                            )}
                          </div>
                          <div className="admin-details">
                            <h3>
                              {admin.firstName || admin.f_name} {admin.lastName || admin.l_name}
                              {isCurrentUser && <span className="you-badge">You</span>}
                            </h3>
                            <p className="admin-email">{admin.email}</p>
                            {admin.eventAdmin && (
                              <span className="event-admin-badge">
                                <i className="fas fa-calendar-check"></i> Event Admin
                              </span>
                            )}
                          </div>
                        </div>
                        {!isCurrentUser && (
                          <button 
                            className="remove-button"
                            onClick={() => handleRemoveAdmin(adminId)}
                            disabled={removingAdminId === adminId}
                          >
                            {removingAdminId === adminId ? (
                              <span className="spinner"></span>
                            ) : (
                              <i className="fas fa-user-minus"></i>
                            )}
                            Remove
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              
              <div className="add-admin-form">
                <h3>Add New Administrator</h3>
                
                {memberFetchError ? (
                  <form onSubmit={handleAddAdmin}>
                    <div className="form-group">
                      <label>Email Address:</label>
                      <input
                        type="email"
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                        placeholder="Enter email address of the user to make admin"
                        required
                      />
                    </div>
                    
                    <div className="checkbox-group">
                      <input
                        type="checkbox"
                        id="eventAdminCheck"
                        checked={eventAdminEnabled}
                        onChange={(e) => setEventAdminEnabled(e.target.checked)}
                      />
                      <label htmlFor="eventAdminCheck">
                        Grant admin privileges for all events
                      </label>
                    </div>
                    
                    <button 
                      type="submit" 
                      className="add-admin-button"
                      disabled={addingAdmin || !newAdminEmail}
                    >
                      {addingAdmin ? (
                        <>
                          <span className="spinner"></span>
                          Adding...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-user-shield"></i>
                          Add Administrator
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <div className="admin-selection-container">
                    <div className="selection-header">
                      <p>Select members to add as administrators:</p>
                      
                      <div className="search-container">
                        <input 
                          type="text"
                          placeholder="Search members..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="member-search-input"
                        />
                        <i className="fas fa-search search-icon"></i>
                      </div>
                    </div>
                    
                    <div className="admin-privileges">
                      <label className="checkbox-container">
                        <input
                          type="checkbox"
                          checked={eventAdminEnabled}
                          onChange={(e) => setEventAdminEnabled(e.target.checked)}
                        />
                        <span className="checkmark"></span>
                        <span className="privilege-label">
                          Grant event admin privileges to selected members
                          <i className="fas fa-info-circle info-icon" title="Event admins can manage all events created under this organization"></i>
                        </span>
                      </label>
                    </div>
                    
                    {availableMembers.length === 0 ? (
                      <div className="no-available-members">
                        <p>All members are already administrators</p>
                      </div>
                    ) : (
                      <div className="members-selection-list">
                        {availableMembers
                          .filter(member => {
                            if (!searchTerm) return true;
                            const fullName = `${member.firstName || ''} ${member.lastName || ''}`.toLowerCase();
                            return fullName.includes(searchTerm.toLowerCase()) || 
                                  member.email.toLowerCase().includes(searchTerm.toLowerCase());
                          })
                          .map(member => (
                            <div 
                              key={member.userID || member.id} 
                              className={`member-selection-item ${
                                selectedMembers.includes(member.userID || member.id) ? 'selected' : ''
                              }`}
                              onClick={() => handleMemberSelection(member.userID || member.id)}
                            >
                              <div className="member-selection-checkbox">
                                <input 
                                  type="checkbox"
                                  checked={selectedMembers.includes(member.userID || member.id)}
                                  onChange={() => {}}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              
                              <div className="member-selection-avatar">
                                {member.profileImage ? (
                                  <ImageLoader 
                                    src={member.profileImage} 
                                    alt={`${member.firstName || ''} ${member.lastName || ''}`} 
                                  />
                                ) : (
                                  <div className="avatar-placeholder">
                                    {(member.firstName || '?').charAt(0)}
                                  </div>
                                )}
                              </div>
                              
                              <div className="member-selection-details">
                                <h4>{member.firstName || ''} {member.lastName || ''}</h4>
                                <p>{member.email}</p>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                    
                    <div className="admin-actions">
                      <button 
                        type="button" 
                        className="add-admin-button"
                        disabled={addingAdmin || selectedMembers.length === 0}
                        onClick={handleAddAdmin}
                      >
                        {addingAdmin ? (
                          <>
                            <span className="spinner"></span>
                            Adding...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-user-shield"></i>
                            Add {selectedMembers.length} {selectedMembers.length === 1 ? 'Admin' : 'Admins'}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EditOrganization;