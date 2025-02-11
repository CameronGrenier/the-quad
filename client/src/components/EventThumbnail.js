import React from 'react';
import './EventThumbnail.css';

const EventThumbnail = ({ event }) => {
  return (
    <div className="event-thumbnail">
      <div
        className="event-thumbnail-image"
        style={{ backgroundImage: `url(${event.background})` }}
      >
        <div className="overlay"></div>
      </div>
      <div className="event-thumbnail-content">
        <h3 className="event-title">{event.title}</h3>
        <p className="event-description">{event.description}</p>
      </div>
    </div>
  );
};

export default EventThumbnail;
