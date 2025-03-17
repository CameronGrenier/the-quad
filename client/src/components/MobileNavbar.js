import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './MobileNavbar.css';
import { ReactComponent as Organization } from '../icons/people-group-solid.svg';
import { ReactComponent as Calendar } from '../icons/calendar-plus-regular.svg';
import { ReactComponent as Fire } from '../icons/fire-solid.svg';
import { ReactComponent as Flag } from '../icons/flag-solid.svg';
import { ReactComponent as Account } from '../icons/user-solid.svg';
import { useAuth } from '../context/AuthContext';

function MobileNavbar() {
  const location = useLocation();
  const { currentUser } = useAuth();
  
  // Helper function to determine if a link is active
  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="mobile-navbar">
      {/* Add SVG definitions for gradients */}
      <svg width="0" height="0" style={{position: 'absolute'}}>
        <defs>
          <linearGradient id="explore-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="20%" stopColor="#6b46c1" />
            <stop offset="80%" stopColor="#e05e00" />
          </linearGradient>
        </defs>
      </svg>
      
      <ul className="nav-list">
        <li className={`nav-item ${isActive('/organizations') ? 'active' : ''}`}>
          <Link to="/organizations">
            <div className="nav-content">
              <Organization />
              <span className="nav-label">Orgs</span>
            </div>
          </Link>
        </li>
        <li className={`nav-item ${isActive('/register-event') ? 'active' : ''}`}>
          <Link to="/register-event">
            <div className="nav-content">
              <Calendar />
              <span className="nav-label">Add</span>
            </div>
          </Link>
        </li>
        <li className={`nav-item ${isActive('/') && location.pathname === '/' ? 'active' : ''}`}>
          <Link to="/">
            <div className="nav-content">
              <Fire />
              <span className="nav-label">Explore</span>
            </div>
          </Link>
        </li>
        <li className={`nav-item ${isActive('/my-events') ? 'active' : ''}`}>
          <Link to="/my-events">
            <div className="nav-content">
              <Flag />
              <span className="nav-label">Events</span>
            </div>
          </Link>
        </li>
        <li className={`nav-item ${isActive('/profile') ? 'active' : ''}`}>
          <Link to={currentUser ? "/profile" : "/login"}>
            <div className="nav-content">
              <Account />
              <span className="nav-label">Profile</span>
            </div>
          </Link>
        </li>
      </ul>
    </nav>
  );
}

export default MobileNavbar;
