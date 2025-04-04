import React, { useState, useEffect, useCallback } from 'react';
import moment from 'moment';
import './PersonalCalendar.css';
import calendarController from '../controllers/CalendarController';

function PersonalCalendar() {
  // State for authentication and calendar data
  const [authStatus, setAuthStatus] = useState({
    gapiInited: false,
    gisInited: false,
    isAuthenticated: false
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [events, setEvents] = useState([]);
  const [calendars, setCalendars] = useState([]);
  const [selectedCalendars, setSelectedCalendars] = useState({});

  // Handle authentication status changes
  const onAuthChange = useCallback((isAuthenticated) => {
    console.log("Auth status changed:", isAuthenticated);
    setAuthStatus(prev => ({ ...prev, isAuthenticated }));
    
    if (isAuthenticated) {
      // Fetch calendar data when authenticated
      fetchAllCalendarEvents();
    } else {
      // Clear data when not authenticated
      setEvents([]);
      setCalendars([]);
      setSelectedCalendars({});
    }
  }, []);

  // Initialize calendar controller
  useEffect(() => {
    // Set up listeners for calendar controller
    calendarController.setListeners({
      onAuthChange,
      onError: (message) => setError(message),
      onLog: (message) => console.log(message)
    });

    // Initialize calendar controller
    calendarController.initialize().catch(err => {
      setError(`Failed to initialize calendar integration: ${err.message}`);
    });
    
    return () => {
      // Clean up listeners
      calendarController.setListeners({
        onAuthChange: () => {},
        onError: () => {},
        onLog: () => {}
      });
    };
  }, [onAuthChange]);

  // Fetch calendar events
  const fetchAllCalendarEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Calculate date range for the current month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      // Fetch calendar events
      const result = await calendarController.fetchAllCalendarEvents(
        startOfMonth.toISOString(),
        endOfMonth.toISOString()
      );
      
      // Log raw data to debug
      console.log('Raw calendar data:', result);
      
      // Set available calendars
      if (result.calendars && Array.isArray(result.calendars)) {
        setCalendars(result.calendars);
        
        // Initialize selected calendars if needed
        if (Object.keys(selectedCalendars).length === 0) {
          const initialSelection = {};
          result.calendars.forEach(cal => {
            initialSelection[cal.id] = true; // Enable all calendars by default
          });
          setSelectedCalendars(initialSelection);
        }
      }
      
      // Format events with explicit string fields
      const formattedEvents = (result.allEvents || []).map(event => {
        return {
          id: String(event.id || `event-${Math.random()}`),
          title: String(event.summary || 'Untitled Event'),
          start: new Date(event.start?.dateTime || event.start?.date || Date.now()),
          end: new Date(event.end?.dateTime || event.end?.date || Date.now() + 3600000),
          allDay: !event.start?.dateTime,
          calendarId: String(event.calendarId || 'default'),
          calendarName: String(event.calendarName || 'Calendar'),
          backgroundColor: String(event.calendarColor || '#3174ad'),
          description: String(event.description || ''),
          location: String(event.location || '')
        };
      });
      
      console.log('Formatted events:', formattedEvents);
      setEvents(formattedEvents);
    } catch (err) {
      setError(`Failed to load calendar events: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedCalendars]);

  // Toggle a calendar selection
  const toggleCalendar = (calendarId) => {
    setSelectedCalendars(prev => ({
      ...prev,
      [calendarId]: !prev[calendarId]
    }));
  };

  // Filter events based on selected calendars
  const filteredEvents = events.filter(event => 
    selectedCalendars[event.calendarId]
  );

  // Format event date/time
  const formatEventDateTime = (event) => {
    if (event.allDay) {
      return `${moment(event.start).format('MMM D, YYYY')} (All day)`;
    }
    return `${moment(event.start).format('MMM D, YYYY, h:mm A')} - ${moment(event.end).format('h:mm A')}`;
  };

  return (
    <div className="personal-calendar-container">
      <div className="calendar-header">
        <h2>Personal Calendar</h2>
        <div className="auth-buttons">
          {authStatus.isAuthenticated ? (
            <button onClick={() => calendarController.signOut()}>
              Disconnect Google Calendar
            </button>
          ) : (
            <button onClick={() => calendarController.signIn()}>
              Connect Google Calendar
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {loading && <div className="loading">Loading calendar data...</div>}

      {authStatus.isAuthenticated && (
        <>
          <div className="calendar-sidebar">
            <h3>Calendars</h3>
            <ul className="calendar-list">
              {calendars.map(calendar => (
                <li key={calendar.id} className="calendar-item">
                  <label className="calendar-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedCalendars[calendar.id] || false}
                      onChange={() => toggleCalendar(calendar.id)}
                    />
                    <span 
                      className="calendar-color" 
                      style={{ backgroundColor: calendar.color }}
                    ></span>
                    {String(calendar.name || 'Unnamed Calendar')}
                  </label>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="events-list">
            <h3>Upcoming Events ({filteredEvents.length})</h3>
            {filteredEvents.length === 0 ? (
              <p>No events found.</p>
            ) : (
              <ul>
                {filteredEvents.map(event => (
                  <li key={event.id} 
                      className="event-item"
                      style={{ borderLeft: `4px solid ${event.backgroundColor}` }}>
                    <h4>{event.title}</h4>
                    <p className="event-time">{formatEventDateTime(event)}</p>
                    <p className="event-calendar">{event.calendarName}</p>
                    {event.location && <p className="event-location">Location: {event.location}</p>}
                    {event.description && <p className="event-description">Description: {event.description}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {!authStatus.isAuthenticated && (
        <div className="connect-message">
          <p>Connect your Google Calendar to view and manage your events.</p>
        </div>
      )}
    </div>
  );
}

export default PersonalCalendar;