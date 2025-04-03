import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AdminDashboard.css';

function AdminDashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isStaff, setIsStaff] = useState(false);
  const [pendingOrgs, setPendingOrgs] = useState([]);
  const [pendingEvents, setPendingEvents] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemType, setItemType] = useState(null); // 'org' or 'event'
  const [detailedData, setDetailedData] = useState(null);
  const [processingAction, setProcessingAction] = useState(false);
  const [error, setError] = useState(null); // Add error state to track and display API errors

  const API_URL = process.env.REACT_APP_API_URL || 'https://the-quad-worker.gren9484.workers.dev';

  // Check if user is staff
  useEffect(() => {
    async function checkStaffStatus() {
      try {
        if (!currentUser) {
          navigate('/login');
          return;
        }

        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/admin/test-staff`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        const data = await response.json();
        
        if (data.success && data.isInStaffTable) {
          setIsStaff(true);
          fetchPendingItems();
        } else {
          setIsStaff(false);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error checking staff status:', error);
        setIsStaff(false);
        setLoading(false);
      }
    }

    checkStaffStatus();
  }, [currentUser, navigate]);

  // Fetch pending items
  const fetchPendingItems = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/admin/pending-requests`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        setPendingOrgs(data.pendingOrganizations || []);
        setPendingEvents(data.pendingEvents || []);
      } else {
        console.error('Failed to fetch pending items:', data.error);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching pending items:', error);
      setLoading(false);
    }
  };

  // Select item for detailed view
  const viewDetails = async (id, type) => {
    setSelectedItem(id);
    setItemType(type);
    setError(null); // Clear any previous errors
    
    try {
      const token = localStorage.getItem('token');
      let endpoint = '';
      
      if (type === 'org') {
        endpoint = `${API_URL}/api/admin/org-details/${id}`;
      } else {
        endpoint = `${API_URL}/api/admin/event-details/${id}`;
      }
      
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setDetailedData(data);
      } else {
        throw new Error(data.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error(`Failed to fetch ${type} details:`, error);
      setError(`Error loading details: ${error.message}`);
      setDetailedData(null);
    }
  };

  // Handle approval
  const handleApprove = async (id, type) => {
    try {
      setProcessingAction(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/api/admin/approve-official`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          [type === 'org' ? 'orgID' : 'eventID']: id
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Refresh the list
        fetchPendingItems();
        
        // Clear selection if the approved item was selected
        if (selectedItem === id && itemType === type) {
          setSelectedItem(null);
          setItemType(null);
          setDetailedData(null);
        }
      } else {
        console.error('Failed to approve item:', data.error);
        alert(`Failed to approve: ${data.error}`);
      }
    } catch (error) {
      console.error('Error approving item:', error);
      alert('An error occurred while approving');
    } finally {
      setProcessingAction(false);
    }
  };

  // Handle rejection
  const handleReject = async (id, type) => {
    try {
      setProcessingAction(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/api/admin/reject-official`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          [type === 'org' ? 'orgID' : 'eventID']: id
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Refresh the list
        fetchPendingItems();
        
        // Clear selection if the rejected item was selected
        if (selectedItem === id && itemType === type) {
          setSelectedItem(null);
          setItemType(null);
          setDetailedData(null);
        }
      } else {
        console.error('Failed to reject item:', data.error);
        alert(`Failed to reject: ${data.error}`);
      }
    } catch (error) {
      console.error('Error rejecting item:', error);
      alert('An error occurred while rejecting');
    } finally {
      setProcessingAction(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div className="admin-dashboard">
        <div className="access-denied">
          <h2>Access Denied</h2>
          <p>You do not have permission to view this page.</p>
          <button onClick={() => navigate('/')}>Return to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>Admin Dashboard</h1>
        <p>Manage official status requests for organizations and events</p>
      </div>

      <div className="dashboard-content">
        <div className="pending-items-panel">
          <div className="pending-section">
            <h2>Pending Organizations ({pendingOrgs.length})</h2>
            <div className="pending-list">
              {pendingOrgs.length === 0 ? (
                <div className="no-pending">No pending organization requests</div>
              ) : (
                pendingOrgs.map(org => (
                  <div 
                    key={org.orgID} 
                    className={`pending-item ${selectedItem === org.orgID && itemType === 'org' ? 'selected' : ''}`}
                  >
                    <div className="item-info" onClick={() => viewDetails(org.orgID, 'org')}>
                      {org.thumbnail && (
                        <img src={org.thumbnail} alt={org.name} className="item-thumbnail" />
                      )}
                      <div className="item-details">
                        <h3>{org.name}</h3>
                        <p>{org.description ? org.description.substring(0, 60) + '...' : 'No description'}</p>
                      </div>
                    </div>
                    <div className="item-actions">
                      <button 
                        className="approve-btn" 
                        onClick={() => handleApprove(org.orgID, 'org')}
                        disabled={processingAction}
                      >
                        Approve
                      </button>
                      <button 
                        className="reject-btn" 
                        onClick={() => handleReject(org.orgID, 'org')}
                        disabled={processingAction}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pending-section">
            <h2>Pending Events ({pendingEvents.length})</h2>
            <div className="pending-list">
              {pendingEvents.length === 0 ? (
                <div className="no-pending">No pending event requests</div>
              ) : (
                pendingEvents.map(event => (
                  <div 
                    key={event.eventID} 
                    className={`pending-item ${selectedItem === event.eventID && itemType === 'event' ? 'selected' : ''}`}
                  >
                    <div className="item-info" onClick={() => viewDetails(event.eventID, 'event')}>
                      {event.thumbnail && (
                        <img src={event.thumbnail} alt={event.title} className="item-thumbnail" />
                      )}
                      <div className="item-details">
                        <h3>{event.title}</h3>
                        <p>{event.description ? event.description.substring(0, 60) + '...' : 'No description'}</p>
                        <p className="event-date">
                          {new Date(event.startDate).toLocaleDateString()} - {new Date(event.endDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="item-actions">
                      <button 
                        className="approve-btn" 
                        onClick={() => handleApprove(event.eventID, 'event')}
                        disabled={processingAction}
                      >
                        Approve
                      </button>
                      <button 
                        className="reject-btn" 
                        onClick={() => handleReject(event.eventID, 'event')}
                        disabled={processingAction}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="detailed-view-panel">
          {error && (
            <div className="error-message">
              <p>{error}</p>
            </div>
          )}
          
          {selectedItem && detailedData ? (
            <div className="detailed-view">
              {itemType === 'org' ? (
                <div className="org-details">
                  <h2>{detailedData.organization.name}</h2>
                  
                  {detailedData.organization.banner && (
                    <div className="banner-container">
                      <img src={detailedData.organization.banner} alt="Organization banner" className="detail-banner" />
                    </div>
                  )}
                  
                  <div className="detail-section">
                    <h3>Description</h3>
                    <p>{detailedData.organization.description || 'No description provided'}</p>
                  </div>
                  
                  <div className="detail-section">
                    <h3>Statistics</h3>
                    <div className="stats-grid">
                      <div className="stat">
                        <span className="stat-value">{detailedData.memberCount || 0}</span>
                        <span className="stat-label">Members</span>
                      </div>
                      <div className="stat">
                        <span className="stat-value">{detailedData.eventsCount || 0}</span>
                        <span className="stat-label">Events</span>
                      </div>
                      <div className="stat">
                        <span className="stat-value">{detailedData.totalRSVPs || 0}</span>
                        <span className="stat-label">Total RSVPs</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="detail-section">
                    <h3>Admins</h3>
                    {detailedData.admins && detailedData.admins.length > 0 ? (
                      <ul className="admin-list">
                        {detailedData.admins.map(admin => (
                          <li key={admin.userID} className="admin-item">
                            <span>User ID: {admin.userID}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No admins found</p>
                    )}
                  </div>
                  
                  <div className="detail-section">
                    <h3>Events</h3>
                    {detailedData.events && detailedData.events.length > 0 ? (
                      <div className="events-list">
                        {detailedData.events.map(event => (
                          <div key={event.eventID} className="event-item">
                            {event.thumbnail && (
                              <img src={event.thumbnail} alt={event.title} className="event-thumbnail" />
                            )}
                            <div className="event-info">
                              <h4>{event.title}</h4>
                              <p className="event-date">
                                {new Date(event.startDate).toLocaleDateString()} - {new Date(event.endDate).toLocaleDateString()}
                              </p>
                              <p>{event.description ? event.description.substring(0, 100) + '...' : 'No description'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p>No events found</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="event-details">
                  <h2>{detailedData.event.title}</h2>
                  
                  {detailedData.event.banner && (
                    <div className="banner-container">
                      <img src={detailedData.event.banner} alt="Event banner" className="detail-banner" />
                    </div>
                  )}
                  
                  <div className="detail-section">
                    <h3>Event Information</h3>
                    <p><strong>Date:</strong> {new Date(detailedData.event.startDate).toLocaleString()} - {new Date(detailedData.event.endDate).toLocaleString()}</p>
                    <p><strong>Location:</strong> {detailedData.event.customLocation || 'No location specified'}</p>
                    <p><strong>Description:</strong> {detailedData.event.description || 'No description provided'}</p>
                  </div>
                  
                  <div className="detail-section">
                    <h3>Organization</h3>
                    {detailedData.organization ? (
                      <div className="parent-org">
                        {detailedData.organization.thumbnail && (
                          <img src={detailedData.organization.thumbnail} alt={detailedData.organization.name} className="org-thumbnail" />
                        )}
                        <div className="org-info">
                          <h4>{detailedData.organization.name}</h4>
                          <p>{detailedData.organization.description ? detailedData.organization.description.substring(0, 100) + '...' : 'No description'}</p>
                        </div>
                      </div>
                    ) : (
                      <p>No organization information found</p>
                    )}
                  </div>
                  
                  <div className="detail-section">
                    <h3>RSVP Statistics</h3>
                    <div className="stats-grid">
                      <div className="stat">
                        <span className="stat-value">{detailedData.rsvpStats?.attending || 0}</span>
                        <span className="stat-label">Attending</span>
                      </div>
                      <div className="stat">
                        <span className="stat-value">{detailedData.rsvpStats?.maybe || 0}</span>
                        <span className="stat-label">Maybe</span>
                      </div>
                      <div className="stat">
                        <span className="stat-value">{detailedData.rsvpStats?.declined || 0}</span>
                        <span className="stat-label">Declined</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="detail-section">
                    <h3>Admins</h3>
                    {detailedData.admins && detailedData.admins.length > 0 ? (
                      <ul className="admin-list">
                        {detailedData.admins.map(admin => (
                          <li key={admin.userID} className="admin-item">
                            <span>User ID: {admin.userID}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No admins found</p>
                    )}
                  </div>
                </div>
              )}
              
              <div className="detail-actions">
                <button 
                  className="approve-btn" 
                  onClick={() => handleApprove(selectedItem, itemType)}
                  disabled={processingAction}
                >
                  Approve
                </button>
                <button 
                  className="reject-btn" 
                  onClick={() => handleReject(selectedItem, itemType)}
                  disabled={processingAction}
                >
                  Reject
                </button>
                <button 
                  className="back-btn" 
                  onClick={() => {
                    setSelectedItem(null);
                    setItemType(null);
                    setDetailedData(null);
                  }}
                >
                  Back to List
                </button>
              </div>
            </div>
          ) : !error && (
            <div className="no-selection">
              <p>Select an organization or event to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;