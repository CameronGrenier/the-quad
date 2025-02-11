import React from 'react';
import { useParams } from 'react-router-dom';

function EventDetails() {
  const { id } = useParams();
  // Dummy event details
  const event = { id, title: 'Sample Event', description: 'Event details here.', date: '2025-03-10' };

  return (
    <div>
      <h2>{event.title}</h2>
      <p>Date: {event.date}</p>
      <p>{event.description}</p>
      <button onClick={() => alert('RSVP functionality to be implemented.')}>RSVP</button>
    </div>
  );
}

export default EventDetails;
