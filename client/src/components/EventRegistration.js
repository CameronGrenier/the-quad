import React from 'react';

function EventRegistration() {
  const handleRegister = (e) => {
    e.preventDefault();
    alert('Event registration functionality to be implemented.');
  };

  return (
    <div>
      <h2>Create an Event</h2>
      <form onSubmit={handleRegister}>
        <div>
          <label>Event Title:</label>
          <input type="text" required />
        </div>
        <div>
          <label>Date:</label>
          <input type="date" required />
        </div>
        <div>
          <label>Time:</label>
          <input type="time" required />
        </div>
        <div>
          <label>Location:</label>
          <input type="text" required />
        </div>
        <div>
          <label>Description:</label>
          <textarea required />
        </div>
        <button type="submit">Submit Event</button>
      </form>
    </div>
  );
}

export default EventRegistration;
