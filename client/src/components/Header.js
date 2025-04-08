import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './Header.css';
import { ReactComponent as Calendar } from '../icons/calendar-plus-regular.svg';
import { ReactComponent as Flag } from '../icons/flag-solid.svg';
import { ReactComponent as Fire } from '../icons/fire-solid.svg';
import { ReactComponent as Account } from '../icons/user-solid.svg';
import { ReactComponent as Search } from '../icons/magnifying-glass-solid.svg';
import { ReactComponent as Organization } from '../icons/people-group-solid.svg';
import { ReactComponent as MyOrganization } from '../icons/user-group-solid.svg';
import { ReactComponent as Shield } from '../icons/shield-halved-solid.svg'; // Add this line
import { useAuth } from '../context/AuthContext';

// Add this utility function for profile image
const formatImageUrl = (url) => {
  if (!url) return null;
  if (url === '') return null;
  
  const API_URL = process.env.REACT_APP_API_URL || 'https://the-quad-worker.gren9484.workers.dev';
  
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  if (url.startsWith('/images/')) {
    return `${API_URL}${url}`;
  }
  
  return `${API_URL}/images/${url}`;
};

function Header() {
  const { currentUser, refreshUserData, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Check if current page should have fixed header
  const isFixedHeaderPage = location.pathname === '/' || 
                           location.pathname.match(/^\/organizations\/\d+/);
                           
  // Check if current page is EventPage
  const isEventPage = location.pathname.match(/^\/events\/\d+/);
  
  const [exploreOpen, setExploreOpen] = useState(false);
  const exploreRef = useRef(null);

  const isAuthenticated = !!currentUser;
  const [isStaff, setIsStaff] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exploreRef.current && !exploreRef.current.contains(event.target)) {
        setExploreOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Add this effect to refresh user data when header mounts
  useEffect(() => {
    if (currentUser) {
      refreshUserData();
    }
  }, []); // Run once when component mounts

  // Add this useEffect to check staff status
  useEffect(() => {
    async function checkStaffStatus() {
      if (!isAuthenticated || !currentUser) {
        setIsStaff(false);
        return;
      }
      
      try {
        const API_URL = process.env.REACT_APP_API_URL || 'https://the-quad-worker.gren9484.workers.dev';
        const token = localStorage.getItem('token');
        
// console.log("Testing staff status with token:", token);
        const response = await fetch(`${API_URL}/api/admin/test-staff`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const data = await response.json();
// console.log("Staff test response:", data);
        
        if (data.success && data.isInStaffTable) {
          setIsStaff(true);
// console.log("Direct staff check: TRUE");
        } else {
          setIsStaff(false);
// console.log("Direct staff check: FALSE");
        }
      } catch (error) {
        console.error("Error checking staff status:", error);
        setIsStaff(false);
      }
    }
    
    checkStaffStatus();
  }, [isAuthenticated, currentUser]); // Only depend on currentUser

  return (
    <div className={`header-container ${isFixedHeaderPage ? 'fixed' : 'static'} ${isEventPage ? 'event-page-header' : ''}`}>
      <header>
        <div className="logo">
          <Link to="/">
            <img src={`${process.env.PUBLIC_URL}/images/Quad Logo.svg`} alt="The Quad Logo" />
          </Link>
        </div>
        <nav>
          {/* Navigation list removed as requested */}
          <div className="nav-item">
            <Organization />
            <Link to="/register-organization">Create Organization</Link>
          </div>
          <div className="nav-item">
            <Calendar />
            <Link to="/register-event">Create Event</Link>
          </div>
          
          {/* Explore dropdown - replacing search bar */}
          <div className="nav-item dropdown" ref={exploreRef}>
            <div className="dropdown-trigger" onClick={() => setExploreOpen(!exploreOpen)}>
              <Fire />
              <span>Explore</span>
            </div>
            {exploreOpen && (
              <div className="dropdown-menu">
                <Link to="/organizations" className="dropdown-item" onClick={() => setExploreOpen(false)}>
                  <Organization />
                  <span>Explore Organizations</span>
                </Link>
                <Link to="/events" className="dropdown-item" onClick={() => setExploreOpen(false)}>
                  <Calendar />
                  <span>Explore Events</span>
                </Link>
              </div>
            )}
          </div>
          
          <div className="nav-item">
            <Flag />
            <Link to="/my-events">My Events</Link>
          </div>
          <div className="nav-item">
            <MyOrganization />
            <Link to="/my-organizations">My Organizations</Link>
          </div>

          {/* Add this button to the nav-links section - place it before the logout button */}
          {currentUser && isStaff && (
            <div className="nav-item">
              <Shield />
              <Link to="/admin">Admin Dashboard</Link>
            </div>
          )}
        </nav>
        
        {/* User authentication section */}
        {currentUser ? (
          <Link to="/profile" className="account-link">
            <div className="account">
              {currentUser.profile_picture ? (
                <img 
                  src={formatImageUrl(currentUser.profile_picture)} 
                  alt={`${currentUser.f_name}'s profile`} 
                />
              ) : (
                <Account className='account-icon' />
              )}
            </div>
          </Link>
        ) : (
          <div className="auth-links">
            <Link to="/login" className="login-link">Log In</Link>
            <Link to="/signup" className="signup-link">Sign Up</Link>
          </div>
        )}
      </header>
    </div>
  );
}

export default Header;
