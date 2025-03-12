import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './OrganizationList.css';
import ImageLoader from './ImageLoader';

const API_URL = process.env.REACT_APP_API_URL || 'https://the-quad-worker.gren9484.workers.dev';

function OrganizationList() {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'public', 'private'

  // Update the formatImageUrl function to handle banner paths correctly
  const formatImageUrl = (url, isBackground = false) => {
    if (!url) return null;
    
    // Return null for empty strings
    if (url === '') return null;
    
    // If URL is already absolute (starts with http or https)
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // For direct R2 URLs, extract the proper path
      if (url.includes('r2.cloudflarestorage.com')) {
        // Extract everything after "/images/" including subdirectories
        const pathMatch = url.match(/\/images\/(.+)$/);
        if (pathMatch && pathMatch[1]) {
          return `${API_URL}/images/${pathMatch[1]}`;
        }
      }
      return url;
    }
    
    // Otherwise, route through our API
    return `${API_URL}/images/${url}`;
  };

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
          console.log("Fetched organizations:", data.organizations);
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
        <div className={`search-container ${searchTerm ? 'has-text' : ''}`}>
          <i className="fas fa-search search-icon"></i>
          <input
            type="text"
            placeholder="Search organizations..."
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