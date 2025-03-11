import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Header.css';
import { ReactComponent as Calendar } from '../icons/calendar-plus-regular.svg';
import { ReactComponent as Flag } from '../icons/flag-solid.svg';
import { ReactComponent as Fire } from '../icons/fire-solid.svg';
import { ReactComponent as Account } from '../icons/user-solid.svg';
import { ReactComponent as Search } from '../icons/magnifying-glass-solid.svg';
import { ReactComponent as Organization } from '../icons/people-group-solid.svg';

function Header() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  // Check for user data in localStorage on component mount
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('user');
      }
    }
  }, []);

  const handleLogout = () => {
    // Clear auth data
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setUser(null);
    
    // Redirect to home
    navigate('/');
  };

  return (
    <div className='header-container'>
      <header>
        <div className="logo">
          <Link to="/">
            <img src={`${process.env.PUBLIC_URL}/images/Quad Logo.svg`} alt="The Quad Logo" />
          </Link>
        </div>
        <nav>
          <div className="nav-item">
            <Organization />
            <Link to="/register-organization">Create Organization</Link>
          </div>
          <div className="nav-item">
            <Calendar />
            <Link to="/register-event">Create Event</Link>
          </div>
          <div className="nav-item">
            <Flag />
            <Link to="/my-events">My Events</Link>
          </div>
          <div className="nav-item">
            <Fire />
            <Link to="/featured">Featured</Link>
          </div>
          {/* Search bar */}
          <div className="search-container">
            <Search className='search-icon'/>
            <input type="text" placeholder=""/>
            <button type="submit">Search</button>
          </div>
        </nav>
        
        {/* User authentication section */}
        {user ? (
          <div className="user-menu">
            <div className="account">
              {user.profile_picture ? (
                <img 
                  src={user.profile_picture.startsWith('/images/') 
                    ? `${process.env.REACT_APP_API_URL || 'https://the-quad-worker.gren9484.workers.dev'}${user.profile_picture}` 
                    : user.profile_picture} 
                  alt={`${user.f_name}'s profile`} 
                />
              ) : (
                <Account className='account-icon' />
              )}
            </div>
            <div className="account-dropdown">
              <span className="user-name">{user.f_name} {user.l_name}</span>
              <Link to="/profile">My Profile</Link>
              <button onClick={handleLogout} className="logout-button">Logout</button>
            </div>
          </div>
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
