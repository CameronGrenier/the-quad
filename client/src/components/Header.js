import React from 'react';
import { Link } from 'react-router-dom';
import './Header.css';
import { ReactComponent as Calender } from '../icons/calendar-plus-regular.svg';
import { ReactComponent as Flag} from '../icons/flag-solid.svg';
import { ReactComponent as Fire } from '../icons/fire-solid.svg';
import { ReactComponent as Account } from '../icons/user-solid.svg';
import { ReactComponent as Search } from '../icons/magnifying-glass-solid.svg';



function Header() {
  return (
    <div className='header-container'>
      <header>
        <div className="logo">
          <Link to="/">
            <img src="/images/Quad Logo.svg" alt="The Quad Logo" />
          </Link>
        </div>
        <nav>
          <div className="nav-item">
            {/* <svg src="/images/calendar-plus-regular.svg" alt="Calendar"></svg> */}
            <Calender />
            <Link to="/register-event">Create Event</Link>
          </div>
          <div className="nav-item">
            {/* <svg src="/images/flag-solid.svg" alt="my-events"></svg> */}
            <Flag />
            <Link to="/my-events">My Events</Link>
          </div>
          <div className="nav-item">
            {/* <svg src="/images/fire-solid.svg" alt="Featured" /> */}
            <Fire />
            <Link to="/featured">Featured</Link>
          </div>
          {/* Search bar */}
          <div className="search-container">
            {/* <img src="/images/magnifying-glass-solid.svg" alt="Search" /> */}
            <Search className='search-icon'/>
            <input type="text" placeholder=""/>
            <button type="submit">Search</button>
          </div>
        </nav>
        <div className="account">
          <Link to="/account">
            <Account className='account-icon' />
            {/* <img src="/images/user-solid.svg" alt="User Account" /> */}
          </Link>
        </div>
      </header>
    </div>
  );
}

export default Header;
