import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './OrganizationList.css'; // Reuse the existing CSS
import ImageLoader from './ImageLoader';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'https://the-quad-worker.gren9484.workers.dev';

function MyOrganizations() {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'admin', 'member'
  const { currentUser } = useAuth();

  // Format image URLs
  const formatImageUrl = (url, isBackground = false) => {
    if (!url) return null;
    
    if (url === '') return null;
    
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (url.includes('r2.cloudflarestorage.com')) {
        const pathMatch = url.match(/\/images\/(.+)$/);
        if (pathMatch && pathMatch[1]) {
          return `${API_URL}/images/${pathMatch[1]}`;
        }
      }
      return url;
    }
    
    if (url.startsWith('/images/')) {
      return `${API_URL}${url}`;
    }
    
    return `${API_URL}/images/${url}`;
  };

  useEffect(() => {
    async function fetchMyOrganizations() {
      // Fix: Check for both ID formats
      const userId = currentUser?.id || currentUser?.userID;
      
      if (!userId) {
        console.log("No user ID found in:", currentUser);
        setError('Please log in to view your organizations');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Try to fetch admin organizations
        const adminResponse = await fetch(`${API_URL}/api/user-organizations?userID=${userId}`);
        
        if (!adminResponse.ok) {
          throw new Error('Failed to fetch organizations');
        }
        
        const adminData = await adminResponse.json();
        
        // Mark admin organizations
        let allOrgs = [];
        if (adminData.success) {
          const adminOrgs = adminData.organizations.map(org => ({
            ...org,
            isAdmin: true
          }));
          allOrgs = adminOrgs;
        }
        
        try {
          // Try to fetch member organizations, but handle missing endpoint gracefully
          const memberResponse = await fetch(`${API_URL}/api/user-member-organizations?userID=${userId}`);
          if (memberResponse.ok) {
            const memberData = await memberResponse.json();
            if (memberData.success) {
              // Avoid duplicates
              const adminOrgIds = new Set(allOrgs.map(org => org.orgID));
              const memberOrgs = memberData.organizations
                .filter(org => !adminOrgIds.has(org.orgID))
                .map(org => ({
                  ...org,
                  isAdmin: false
                }));
              allOrgs = [...allOrgs, ...memberOrgs];
            }
          }
        } catch (memberError) {
          console.warn("Member organizations endpoint not available:", memberError);
          // Continue without member organizations
        }
        
        setOrganizations(allOrgs);
      }
      catch (error) {
        console.error('Error fetching organizations:', error);
        setError(error.message);
      }
      finally {
        setLoading(false);
      }
    }
    
    fetchMyOrganizations();
  }, [currentUser]);

  // Filter organizations based on search term and role filter
  const filteredOrganizations = organizations.filter(org => {
    const matchesSearch = org.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (org.description && org.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Filter by role if needed
    if (filter === 'all') return matchesSearch;
    if (filter === 'admin') return matchesSearch && org.isAdmin;
    if (filter === 'member') return matchesSearch && !org.isAdmin;
    
    return matchesSearch;
  });

  return (
    <div className="org-list-page">
      <div className="org-list-header">
        <h1>My Organizations</h1>
        <p>Organizations you're a member of or administer</p>
      </div>
      
      <div className="org-list-controls">
        <div className={`search-container ${searchTerm ? 'has-text' : ''}`}>
          <i className="fas fa-search search-icon"></i>
          <input
            type="text"
            placeholder="Search your organizations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="org-search-input"
          />
          {searchTerm && (
            <button 
              className="clear-search" 
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
            >
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>
        
        <div className="filter-container">
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button 
            className={`filter-btn ${filter === 'admin' ? 'active' : ''}`}
            onClick={() => setFilter('admin')}
          >
            Admin
          </button>
          <button 
            className={`filter-btn ${filter === 'member' ? 'active' : ''}`}
            onClick={() => setFilter('member')}
          >
            Member
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="org-loading">
          <div className="org-loading-spinner"></div>
          <p>Loading your organizations...</p>
        </div>
      ) : error ? (
        <div className="org-error">
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Try Again</button>
        </div>
      ) : (
        <div className="org-grid">
          {filteredOrganizations.length > 0 ? (
            filteredOrganizations.map(org => (
              <Link to={`/organizations/${org.orgID}`} key={org.orgID} className="org-card-link">
                <div className="org-card">
                  <div className="org-card-banner" 
                    style={org.banner ? {
                      backgroundImage: `url(${formatImageUrl(org.banner, true)})`
                    } : {
                      background: 'linear-gradient(to right, #4c2889, #c05621)'
                    }}>
                  </div>
                  <div className="org-card-avatar">
                    {org.thumbnail ? (
                      <ImageLoader 
                        src={org.thumbnail} 
                        alt={org.name}
                        className="org-avatar-img" 
                      />
                    ) : (
                      <div className="org-avatar-placeholder">
                        {org.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="org-card-content">
                    <h3>{org.name}</h3>
                    <div className="org-card-meta">
                      <span className="org-privacy-badge">{org.privacy === 'public' ? 'Public' : 'Private'}</span>
                      {org.isAdmin && <span className="org-admin-badge">Admin</span>}
                      <span className="org-member-count">{org.memberCount || 0} members</span>
                    </div>
                    <p className="org-description-preview">
                      {org.description ? (
                        org.description.length > 100 ? 
                        `${org.description.substring(0, 100)}...` : 
                        org.description
                      ) : 'No description available.'}
                    </p>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="no-orgs-found">
              <h3>You haven't joined any organizations yet</h3>
              <p>Find organizations to join in the Explore Organizations section</p>
              <Link to="/organizations" className="create-org-button">
                Browse Organizations
              </Link>
            </div>
          )}
        </div>
      )}
      
      <div className="create-org-container">
        <Link to="/register-organization" className="create-org-button">
          Create New Organization
        </Link>
      </div>
    </div>
  );
}

export default MyOrganizations;