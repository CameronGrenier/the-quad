import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './MobileNavbar.css';
import { useAuth } from '../context/AuthContext';

function MobileNavbar() {
  const location = useLocation();
  const { currentUser } = useAuth();
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false); // Add this state
  const [isStaff, setIsStaff] = useState(false);
  const moreMenuRef = useRef(null);
  const createMenuRef = useRef(null); // Add this ref
  
  // Helper function to determine if a link is active
  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      // Handle More menu clicks outside
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setIsMoreMenuOpen(false);
      }
      
      // Handle Create menu clicks outside
      if (createMenuRef.current && !createMenuRef.current.contains(event.target)) {
        setIsCreateMenuOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Check if user is staff
  useEffect(() => {
    async function checkStaffStatus() {
      if (!currentUser) {
        setIsStaff(false);
        return;
      }
      
      try {
        const API_URL = process.env.REACT_APP_API_URL || 'https://the-quad-worker.gren9484.workers.dev';
        const token = localStorage.getItem('token');
        
        const response = await fetch(`${API_URL}/api/admin/test-staff`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        setIsStaff(data.success && data.isInStaffTable);
      } catch (error) {
        console.error("Error checking staff status:", error);
        setIsStaff(false);
      }
    }
    
    checkStaffStatus();
  }, [currentUser]);

  return (
    <nav className="mobile-navbar">
      {/* Add SVG definitions for gradients */}
      <svg width="0" height="0" style={{position: 'absolute'}}>
        <defs>
          <linearGradient id="explore-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="20%" stopColor="#6b46c1" />
            <stop offset="80%" stopColor="#e05e00" />
          </linearGradient>
          <linearGradient id="create-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e05e00" />
            <stop offset="100%" stopColor="#f6ad55" />
          </linearGradient>
          <linearGradient id="more-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4c2889" />
            <stop offset="100%" stopColor="#c05621" />
          </linearGradient>
        </defs>
      </svg>
      
      <ul className="nav-list">
        <li className={`nav-item ${isActive('/') ? 'active' : ''}`}>
          <Link to="/">
            <div className="nav-content">
              <i className="fas fa-home"></i>
              <span className="nav-label">Home</span>
            </div>
          </Link>
        </li>
        
        <li className={`nav-item ${isActive('/events') ? 'active' : ''}`}>
          <Link to="/events">
            <div className="nav-content">
              <i className="fas fa-calendar"></i>
              <span className="nav-label">Events</span>
            </div>
          </Link>
        </li>
        
        {/* Moved Create button to center position (3rd) */}
        <li className={`nav-item ${isCreateMenuOpen ? 'active' : ''} ${isActive('/register-event') || isActive('/register-organization') ? 'active' : ''}`} ref={createMenuRef}>
          <button 
            className="create-button"
            onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)}
            aria-label="Create options"
          >
            <div className="nav-content">
              <i className="fas fa-plus-circle"></i>
              <span className="nav-label">Create</span>
            </div>
          </button>
          
          {isCreateMenuOpen && (
            <div className="create-menu">
              <Link to="/register-event" className="create-item" onClick={() => setIsCreateMenuOpen(false)}>
                <i className="fas fa-calendar-plus"></i>
                <span>Create Event</span>
              </Link>
              
              <Link to="/register-organization" className="create-item" onClick={() => setIsCreateMenuOpen(false)}>
                <i className="fas fa-users-cog"></i>
                <span>Create Organization</span>
              </Link>
            </div>
          )}
        </li>
        
        <li className={`nav-item ${isActive('/organizations') ? 'active' : ''}`}>
          <Link to="/organizations">
            <div className="nav-content">
              <i className="fas fa-users"></i>
              <span className="nav-label">Orgs</span>
            </div>
          </Link>
        </li>
        
        <li className={`nav-item ${isMoreMenuOpen ? 'active' : ''}`} ref={moreMenuRef}>
          <button 
            className="more-button"
            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
            aria-label="More options"
          >
            <div className="nav-content">
              <i className="fas fa-ellipsis-h"></i>
              <span className="nav-label">More</span>
            </div>
          </button>
          
          {isMoreMenuOpen && (
            <div className="more-menu">
              <div className="menu-section">
                <h3 className="menu-section-title">My Content</h3>
                <Link to="/my-events" className="more-item" onClick={() => setIsMoreMenuOpen(false)}>
                  <i className="fas fa-flag"></i>
                  <span>My Events</span>
                </Link>
                
                <Link to="/my-organizations" className="more-item" onClick={() => setIsMoreMenuOpen(false)}>
                  <i className="fas fa-user-friends"></i>
                  <span>My Organizations</span>
                </Link>
                
                <Link to="/calendar" className="more-item" onClick={() => setIsMoreMenuOpen(false)}>
                  <i className="fas fa-calendar-alt"></i>
                  <span>Calendar</span>
                </Link>
              </div>
              
              {isStaff && (
                <div className="menu-section">
                  <h3 className="menu-section-title">Admin</h3>
                  <Link to="/admin" className="more-item admin-item" onClick={() => setIsMoreMenuOpen(false)}>
                    <i className="fas fa-shield-alt"></i>
                    <span>Admin Dashboard</span>
                  </Link>
                </div>
              )}
              
              <div className="menu-section">
                <h3 className="menu-section-title">Account</h3>
                <Link to={currentUser ? "/profile" : "/login"} className="more-item" onClick={() => setIsMoreMenuOpen(false)}>
                  <i className={currentUser ? "fas fa-user-circle" : "fas fa-sign-in-alt"}></i>
                  <span>{currentUser ? "Profile" : "Login/Signup"}</span>
                </Link>
              </div>
            </div>
          )}
        </li>
      </ul>
    </nav>
  );
}

export default MobileNavbar;
