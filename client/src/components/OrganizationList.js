import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './OrganizationList.css';

const API_URL = process.env.REACT_APP_API_URL || 'https://the-quad-worker.gren9484.workers.dev';

function OrganizationList() {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'public', 'private'

  useEffect(() => {
    async function fetchOrganizations() {
      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/api/organizations`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch organizations');
        }
        
        const data = await response.json();
        
        if (data.success) {
          setOrganizations(data.organizations);
        } else {
          throw new Error(data.error || 'Failed to load organizations');
        }
      } catch (error) {
        console.error('Error fetching organizations:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchOrganizations();
  }, []);

  // Filter organizations based on search term and privacy filter
  const filteredOrganizations = organizations.filter(org => {
    const matchesSearch = org.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (org.description && org.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = filter === 'all' || org.privacy === filter;
    
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="org-list-page">
      <div className="org-list-header">
        <h1>Campus Organizations</h1>
        <p>Discover and join organizations on campus</p>
      </div>
      
      <div className="org-list-controls">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search organizations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="org-search-input"
          />
          <i className="fas fa-search search-icon"></i>
        </div>
        
        <div className="filter-container">
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button 
            className={`filter-btn ${filter === 'public' ? 'active' : ''}`}
            onClick={() => setFilter('public')}
          >
            Public
          </button>
          <button 
            className={`filter-btn ${filter === 'private' ? 'active' : ''}`}
            onClick={() => setFilter('private')}
          >
            Private
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="org-loading">
          <div className="org-loading-spinner"></div>
          <p>Loading organizations...</p>
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
                    style={{ backgroundImage: org.banner ? `url(${org.banner})` : 'linear-gradient(to right, #4c2889, #c05621)' }}>
                  </div>
                  <div className="org-card-avatar">
                    {org.thumbnail ? (
                      <img src={org.thumbnail} alt={org.name} />
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
              <h3>No organizations found</h3>
              <p>Try adjusting your search or filter criteria</p>
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

export default OrganizationList;