import React from 'react';
import { Link } from 'react-router-dom';
import './Home.css';
import EventList from './EventList';
import CalendarOverview from './CalendarOverview';
import Footer from './Footer';

function Home() {
  return (
    <div className="container">
      <div className="home">
        <h2>Welcome to</h2>
        <h1>The Quad</h1>
      </div>
      <div className='EventList'>
        <EventList /* pass any required props */ />
      </div>
      <div className='CalendarOverview'>
        <CalendarOverview /* pass any required props */ />
      </div>
      <div className='Footer'>
        <Footer />
      </div>
    </div>
  );
}

export default Home;
