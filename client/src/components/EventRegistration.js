import React, { useState } from 'react';

function EventRegistration() {
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    time: '',
    location: '',
    description: '',
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Event registration functionality to be implemented.');
    // Here you could send formData to your backend API
  };

  return (
    <div>
      <h2>Create an Event</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Event Title:</label>
          <input 
            type="text" 
            name="title" 
            value={formData.title} 
            onChange={handleChange} 
            required 
          />
        </div>
        <div>
          <label>Date:</label>
          <input 
            type="date" 
            name="date" 
            value={formData.date} 
            onChange={handleChange} 
            required 
          />
        </div>
        <div>
          <label>Time:</label>
          <input 
            type="time" 
            name="time" 
            value={formData.time} 
            onChange={handleChange} 
            required 
          />
        </div>
        <div>
          <label>Location:</label>
          <input 
            type="text" 
            name="location" 
            value={formData.location} 
            onChange={handleChange} 
            required 
          />
        </div>
        <div>
          <label>Description:</label>
          <textarea 
            name="description" 
            value={formData.description} 
            onChange={handleChange} 
            required 
          />
        </div>
        <button type="submit">Submit Event</button>
      </form>
    </div>
  );
}

export default EventRegistration;
