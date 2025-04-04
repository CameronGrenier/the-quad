import React, { useState, useEffect, useCallback } from 'react';
import moment from 'moment';
import './PersonalCalendar.css';
import calendarController from '../controllers/CalendarController';

// Import FullCalendar and plugins
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';

function PersonalCalendar() {
  // Authentication and data state
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
  
  // UI state
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' or 'list'
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Handle authentication status changes
  const onAuthChange = useCallback((isAuthenticated) => {
    console.log("Auth status changed:", isAuthenticated);
    setAuthStatus(prev => ({ ...prev, isAuthenticated }));
    
    if (isAuthenticated) {
      // Fetch calendar data when authenticated
      fetchCalendarData();
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

    // Initialize calendar controller with persistent auth check
    const initializeController = async () => {
      try {
        setLoading(true);
        // Initialize and check existing token
        await calendarController.initialize();
        
        // Check if we already have a valid token
        const isSignedIn = await calendarController.checkIfSignedIn();
        if (isSignedIn) {
          console.log("User already signed in, fetching calendar data...");
          onAuthChange(true);
          
          // Trigger calendar sync on load
          try {
            console.log("Syncing calendar on load...");
            await calendarController.syncCalendarWithRsvp();
            console.log("Calendar sync completed successfully");
          } catch (syncError) {
            console.error("Failed to sync calendar on load:", syncError);
          }
        } else {
          console.log("User not signed in");
          onAuthChange(false);
        }
      } catch (err) {
        setError(`Failed to initialize calendar integration: ${err.message}`);
        console.error("Calendar initialization error:", err);
      } finally {
        setLoading(false);
      }
    };

    initializeController();
    
    return () => {
      // Clean up listeners
      calendarController.setListeners({
        onAuthChange: () => {},
        onError: () => {},
        onLog: () => {}
      });
    };
  }, [onAuthChange]);

  // Fetch calendar data
  const fetchCalendarData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Calculate date range - get a 3-month window
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1); // One month ago
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);   // Two months ahead
      
      // Fetch calendar events
      const result = await calendarController.fetchAllCalendarEvents(
        start.toISOString(),
        end.toISOString()
      );
      
      console.log('Raw calendar data:', result);
      
      // Process calendars
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
      
      // Format events for FullCalendar
      const formattedEvents = (result.allEvents || []).map(event => {
        return {
          id: String(event.id || `event-${Math.random()}`),
          title: String(event.summary || 'Untitled Event'),
          start: new Date(event.start?.dateTime || event.start?.date || Date.now()),
          end: new Date(event.end?.dateTime || event.end?.date || Date.now() + 3600000),
          allDay: !event.start?.dateTime,
          backgroundColor: String(event.calendarColor || '#3174ad'),
          borderColor: String(event.calendarColor || '#3174ad'),
          extendedProps: {
            calendarId: String(event.calendarId || 'default'),
            calendarName: String(event.calendarName || 'Calendar'),
            description: String(event.description || ''),
            location: String(event.location || '')
          }
        };
      });
      
      console.log('Formatted events:', formattedEvents);
      setEvents(formattedEvents);
    } catch (err) {
      setError(`Failed to load calendar events: ${err.message}`);
      console.error('Calendar fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCalendars]);

  // Filter events based on selected calendars
  const filteredEvents = events.filter(event => 
    selectedCalendars[event.extendedProps.calendarId]
  );

  // Toggle a calendar selection
  const toggleCalendar = (calendarId) => {
    setSelectedCalendars(prev => ({
      ...prev,
      [calendarId]: !prev[calendarId]
    }));
  };

  // Format event date/time
  const formatEventDateTime = (event) => {
    if (!event || !event.start) return '';
    
    try {
      if (event.allDay) {
        return `${moment(event.start).format('MMM D, YYYY')} (All day)`;
      }
      return `${moment(event.start).format('MMM D, YYYY, h:mm A')} - ${moment(event.end).format('h:mm A')}`;
    } catch (err) {
      console.error("Error formatting event date:", err);
      return '';
    }
  };

  // Handle event click
  const handleEventClick = (info) => {
    const event = info.event;
    
    const safeEvent = {
      id: event.id || '',
      title: event.title || 'Untitled Event',
      start: event.start || new Date(),
      end: event.end || new Date(),
      allDay: event.allDay,
      calendarId: event.extendedProps?.calendarId || '',
      calendarName: event.extendedProps?.calendarName || '',
      backgroundColor: event.backgroundColor || '#3174ad',
      description: event.extendedProps?.description || '',
      location: event.extendedProps?.location || ''
    };
    
    setSelectedEvent(safeEvent);
    setShowEventDetails(true);
  };

  return (
    <div className="personal-calendar-container">
      <div className="calendar-header">
        <h2>Personal Calendar</h2>
        <div className="auth-buttons">
          {authStatus.isAuthenticated && (
            <div className="view-toggle">
              <button 
                className={viewMode === 'list' ? 'active' : ''} 
                onClick={() => setViewMode('list')}
              >
                List View
              </button>
              <button 
                className={viewMode === 'calendar' ? 'active' : ''} 
                onClick={() => setViewMode('calendar')}
              >
                Calendar View
              </button>
            </div>
          )}
          
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

      {!authStatus.isAuthenticated && (
        <div className="connect-message">
          <p>Connect your Google Calendar to view and manage your events.</p>
        </div>
      )}

      {authStatus.isAuthenticated && (
        <div className="calendar-layout">
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
                    <span className="calendar-name">{calendar.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="calendar-content">
            {viewMode === 'calendar' ? (
              <div className="full-calendar-wrapper">
                <FullCalendar
                  plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                  initialView="dayGridMonth"
                  headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: ''
                  }}
                  events={filteredEvents}
                  eventClick={handleEventClick}
                  height="800px"
                  dayMaxEvents={true}
                  nowIndicator={true}
                  eventTimeFormat={{
                    hour: 'numeric',
                    minute: '2-digit',
                    meridiem: 'short'
                  }}
                />
              </div>
            ) : (
              <div className="events-list-wrapper">
                <h3>Upcoming Events</h3>
                {filteredEvents.length === 0 ? (
                  <p className="no-events">No events found</p>
                ) : (
                  <ul className="events-list">
                    {/* Sort events by start time */}
                    {filteredEvents
                      .sort((a, b) => new Date(a.start) - new Date(b.start))
                      .map(event => (
                        <li 
                          key={event.id} 
                          className="event-list-item"
                          onClick={() => {
                            setSelectedEvent({
                              id: event.id,
                              title: event.title,
                              start: event.start,
                              end: event.end,
                              allDay: event.allDay,
                              calendarId: event.extendedProps?.calendarId,
                              calendarName: event.extendedProps?.calendarName,
                              backgroundColor: event.backgroundColor,
                              description: event.extendedProps?.description,
                              location: event.extendedProps?.location
                            });
                            setShowEventDetails(true);
                          }}
                        >
                          <div 
                            className="event-color" 
                            style={{ backgroundColor: event.backgroundColor }}
                          ></div>
                          <div className="event-details">
                            <h4 className="event-title">{event.title}</h4>
                            <p className="event-time">
                              {event.allDay 
                                ? moment(event.start).format('MMM D, YYYY') + ' (All day)' 
                                : moment(event.start).format('MMM D, YYYY, h:mm A')}
                            </p>
                            <p className="event-calendar">{event.extendedProps?.calendarName}</p>
                            {event.extendedProps?.location && (
                              <p className="event-location">📍 {event.extendedProps.location}</p>
                            )}
                          </div>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Event Details Modal */}
      {showEventDetails && selectedEvent && (
        <div className="event-details-modal">
          <div className="event-details-content">
            <div className="event-details-header" 
                 style={{ backgroundColor: selectedEvent.backgroundColor }}>
              <h3>{selectedEvent.title}</h3>
              <button onClick={() => setShowEventDetails(false)}>×</button>
            </div>
            <div className="event-details-body">
              <p><strong>When:</strong> {formatEventDateTime(selectedEvent)}</p>
              <p><strong>Calendar:</strong> {selectedEvent.calendarName}</p>
              {selectedEvent.location && <p><strong>Location:</strong> {selectedEvent.location}</p>}
              {selectedEvent.description && (
                <div>
                  <p><strong>Description:</strong></p>
                  <p>{selectedEvent.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PersonalCalendar;