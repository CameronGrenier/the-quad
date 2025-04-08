import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-section sitemap">
          <h4>Site Map</h4>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/calendar">Calendar</Link></li>
            <li><Link to="/events">Events</Link></li>
            <li><Link to="/organizations">Organizations</Link></li>
            <li><Link to="/login">Login</Link></li>
            <li><Link to="/signup">Sign Up</Link></li>
          </ul>
        </div>
        <div className="footer-section about">
          <h4>About Us</h4>
          <p>The Quad is your ultimate online university event planner, helping you discover campus events and connect with fellow students.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
