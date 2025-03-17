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
import { useAuth } from '../context/AuthContext';

function Header() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Check if current page should have fixed header
  const isFixedHeaderPage = location.pathname === '/' || 
                           location.pathname.match(/^\/organizations\/\d+/);
  const [exploreOpen, setExploreOpen] = useState(false);
  const exploreRef = useRef(null);

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

  return (
    <div className={isFixedHeaderPage ? "header-container fixed" : "header-container"}>
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
        </nav>
        
        {/* User authentication section */}
        {currentUser ? (
          <Link to="/profile" className="account-link">
            <div className="account">
              {currentUser.profile_picture ? (
                <img 
                  src={currentUser.profile_picture.startsWith('/images/') 
                    ? `${process.env.REACT_APP_API_URL || 'https://the-quad-worker.gren9484.workers.dev'}${currentUser.profile_picture}` 
                    : currentUser.profile_picture} 
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
