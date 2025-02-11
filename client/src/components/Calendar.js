import React from 'react';
import { Link } from 'react-router-dom';

function Calendar() {
  // Dummy events array
  const events = [
    { id: 1, title: 'Study Session', date: '2025-03-10' },
    { id: 2, title: 'Guest Lecture', date: '2025-03-12' }
  ];

  return (
    <div>
      <h2>Events Calendar</h2>
      <ul>
        {events.map((event) => (
          <li key={event.id}>
            <Link to={`/event/${event.id}`}>
              {event.title} - {event.date}
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/register-event">
        <button>Create New Event</button>
      </Link>
    </div>
  );
}

export default Calendar;
