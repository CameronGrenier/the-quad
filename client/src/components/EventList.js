import React from 'react';
import EventCarousel from './EventCarousel';
import './EventList.css';

const dummyEvents = [
    {
        background: `${process.env.PUBLIC_URL}/images/dummy-event1.jpg`,
        title: 'Welcome to Campus 2025',
        description: 'Kick off your college journey with a fun-filled orientation! Enjoy campus tours, meet senior mentors, and discover key resources to help you succeed.',
    },
    {
        background: `${process.env.PUBLIC_URL}/images/dummy-event2.jpg`,
        title: 'Campus Hockey Showdown',
        description: 'Cheer on your school\'s team at our Campus Hockey Showdown. Experience thrilling fast-paced action on the ice and join post-game celebrations with friends.',
    },
    {
        background: `${process.env.PUBLIC_URL}/images/dummy-event3.jpg`,
        title: 'The Business Challenge',
        description: 'Showcase your entrepreneurial spirit in Innovate: The Business Challenge. Pitch your creative ideas, network with professionals, and compete for exciting prizes.',
    },
    {
        background: `${process.env.PUBLIC_URL}/images/dummy-event4.jpg`,
        title: 'Charity Gala Night',
        description: 'Dress to impress and support a great cause at our annual Charity Gala Night. Enjoy live music, gourmet dining, and help raise funds for community projects.',
    },
    {
        background: `${process.env.PUBLIC_URL}/images/dummy-event5.jpg`,
        title: 'AI and Robotics Workshop',
        description: 'Dive into the future with our AI and Robotics Workshop. Learn from industry experts, build your own robots, and explore the endless possibilities of artificial intelligence.',
    },
    {
        background: `${process.env.PUBLIC_URL}/images/dummy-event6.jpg`,
        title: 'Outdoor Adventure Day',
        description: 'Escape the classroom and join us for an Outdoor Adventure Day. Hike scenic trails, try rock climbing, and enjoy a BBQ with fellow outdoor enthusiasts.',
    },
];

function EventsList() {
  return (
    <div>
      <h2 className='upcomingEvents'>Upcoming Events</h2>
      <EventCarousel events={dummyEvents} />
    </div>
  );
}

export default EventsList;
