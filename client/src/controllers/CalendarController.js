// Import API_URL from a central location instead
import { API_URL } from '../config/constants';

/**
 * CalendarController - Manages Google Calendar integration
 */
class CalendarController {
  constructor() {
    // API keys and client IDs
    this.API_KEY = 'AIzaSyCT7Oi6lj9KCLeJ8khaNyv_-rziY6oMcjo';
    this.CLIENT_ID = '1018555477374-es86bnf9he036bbt7it7s8d2llk9sh75.apps.googleusercontent.com';
    
    // Define scopes needed for calendar integration
    this.SCOPES = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];
    
    // Authentication state
    this.gapiInited = false;
    this.gisInited = false;
    this.isAuthenticated = false;
    
    // Listeners for callbacks
    this.listeners = {
      onAuthChange: null,
      onError: null,
      onLog: null
    };
  }

  /**
   * Set callback functions for various events
   */
  setListeners(listeners) {
    this.listeners = { ...this.listeners, ...listeners };
  }

  /**
   * Log a message through the listener
   */
  log(message) {
    if (this.listeners.onLog) {
      this.listeners.onLog(message);
    }
// console.log(message);
  }

  /**
   * Initialize Google API libraries with better persistence
   */
  async initialize() {
    this.log("Initializing Google Calendar integration...");
    
    try {
      // Track initialization status
      if (this.initializationPromise) {
        this.log("Initialization already in progress, waiting...");
        return await this.initializationPromise;
      }
      
      // Create a promise to track initialization
      this.initializationPromise = (async () => {
        // Load the GAPI script
        await this.loadGapiScript();
        // Load the GIS script
        await this.loadGisScript();
        
        // Try to restore token from localStorage
        await this.restoreAuthState();
        
        return true;
      })();
      
      return await this.initializationPromise;
    } catch (error) {
      this.listeners.onError?.(error.message);
      this.initializationPromise = null;
      throw error;
    } finally {
      // Clear the promise reference when done
      this.initializationPromise = null;
    }
  }

  /**
   * Restore authentication state from storage
   */
  async restoreAuthState() {
    const storedToken = this.retrieveStoredToken();
    
    if (storedToken && storedToken.access_token) {
      this.log("Found stored token, attempting to restore");
      
      // Check if token has expired
      if (storedToken.expires_at && Date.now() < storedToken.expires_at) {
        try {
          // Set the token in the GAPI client
          window.gapi.client.setToken(storedToken);
          this.log("Setting stored token in GAPI client");
          
          // Verify token with a simple API call
          await window.gapi.client.calendar.calendarList.list({
            maxResults: 1
          });
          
          this.log("Successfully verified and restored authentication");
          this.isAuthenticated = true;
          this.listeners.onAuthChange?.(true);
          return true;
        } catch (error) {
          this.log(`Token verification failed: ${error.message}`);
          this.clearStoredToken();
          this.isAuthenticated = false;
        }
      } else {
        this.log("Stored token has expired");
        this.clearStoredToken();
      }
    }
    
    this.isAuthenticated = false;
    return false;
  }

  /**
   * Load the Google API Client Library (gapi)
   */
  loadGapiScript() {
    return new Promise((resolve, reject) => {
      this.log("Loading Google API client...");
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        this.log("GAPI script loaded");
        this.initializeGapiClient()
          .then(resolve)
          .catch(reject);
      };
      
      script.onerror = () => {
        const error = "Failed to load Google API";
        this.log(error);
        reject(new Error(error));
      };
      
      document.body.appendChild(script);
    });
  }

  /**
   * Load the Google Identity Services Library (gis)
   */
  loadGisScript() {
    return new Promise((resolve, reject) => {
      this.log("Loading Google Identity Services...");
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        this.log("GIS script loaded");
        this.initializeGisClient();
        resolve();
      };
      
      script.onerror = () => {
        const error = "Failed to load Google Identity Services";
        this.log(error);
        reject(new Error(error));
      };
      
      document.body.appendChild(script);
    });
  }

  /**
   * Initialize the gapi client with API key and discovery docs
   */
  async initializeGapiClient() {
    this.log("Initializing GAPI client...");
    
    try {
      await new Promise((resolve, reject) => {
        window.gapi.load('client', { 
          callback: resolve, 
          onerror: reject 
        });
      });
      
      await window.gapi.client.init({
        apiKey: this.API_KEY,
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
      });
      
      this.gapiInited = true;
      this.log("GAPI client initialized successfully");
      return true;
    } catch (error) {
      this.log(`GAPI initialization error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Initialize the Google Identity Services client
   */
  initializeGisClient() {
    this.log("Initializing GIS client...");
    
    try {
      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: this.CLIENT_ID,  // Changed from this.GOOGLE_CLIENT_ID
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
        callback: (resp) => this.handleTokenResponse(resp),
      });
      
      this.gisInited = true;
      this.log("GIS client initialized successfully");
      return true;
    } catch (error) {
      this.log(`GIS initialization error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle the response from token request
   */
  handleTokenResponse(resp) {
    if (resp.error !== undefined) {
      this.log(`Token error: ${resp.error}`);
      this.isAuthenticated = false;
      this.listeners.onError?.(resp.error);
      this.listeners.onAuthChange?.(false);
      return;
    }
    
    this.log("Successfully authenticated with Google");
    this.isAuthenticated = true;
    
    // Make sure we update the token in gapi client for persistence
    if (resp.access_token) {
      const token = {
        access_token: resp.access_token,
        expires_at: Date.now() + (resp.expires_in * 1000) // Convert seconds to milliseconds
      };
      
      window.gapi.client.setToken(token);
      this.storeToken(token); // Store token in localStorage
    }
    
    this.listeners.onAuthChange?.(true);
  }

  /**
   * Request access token from Google with better error handling
   */
  async signIn() {
    this.log("Requesting access token...");
    
    // Check if SCOPES is defined
    if (!this.SCOPES || !Array.isArray(this.SCOPES)) {
      this.SCOPES = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
      ];
      this.log("SCOPES was undefined, created default scopes");
    }
    
    // Check if APIs are initialized
    if (!this.gapiInited || !this.gisInited) {
      this.log("APIs not fully initialized, attempting to initialize now...");
      
      try {
        // Try to initialize before signing in
        await this.initialize();
        
        // Double-check initialization status after attempt
        if (!this.gapiInited || !this.gisInited) {
          const error = "Failed to initialize Google APIs";
          this.log(error);
          this.listeners.onError?.(error);
          return false;
        }
      } catch (error) {
        this.log(`Initialization failed: ${error.message}`);
        this.listeners.onError?.(`Failed to initialize: ${error.message}`);
        return false;
      }
    }
  
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: this.CLIENT_ID,
        scope: this.SCOPES.join(' '),
        callback: (resp) => this.handleTokenResponse(resp)
      });
      
      // Request token
      client.requestAccessToken();
      return true;
    } catch (error) {
      this.log(`Error requesting token: ${error.message}`);
      this.listeners.onError?.(`Error requesting access: ${error.message}`);
      return false;
    }
  }

  /**
   * Sign out and revoke the token
   */
  signOut() {
    this.log("Revoking token...");
    
    const token = window.gapi.client.getToken();
    if (token !== null) {
      window.google.accounts.oauth2.revoke(token.access_token, () => {
        this.log("Token revoked");
        window.gapi.client.setToken('');
        this.clearStoredToken(); // Clear from localStorage
        this.isAuthenticated = false;
        this.listeners.onAuthChange?.(false);
      });
      return true;
    } else {
      this.log("No token to revoke");
      this.clearStoredToken(); // Clear any potential remains
      this.isAuthenticated = false;
      this.listeners.onAuthChange?.(false);
      return false;
    }
  }

  /**
   * Get the authentication status
   */
  getAuthStatus() {
    return {
      gapiInited: this.gapiInited,
      gisInited: this.gisInited,
      isAuthenticated: this.isAuthenticated
    };
  }

  /**
   * Fetch events from the primary calendar
   */
  async fetchPrimaryCalendarEvents(timeMin, timeMax) {
    this.log("Fetching primary calendar events...");
    
    if (!this.gapiInited || !this.isAuthenticated) {
      const error = "Cannot fetch events: not initialized or not authenticated";
      this.log(error);
      throw new Error(error);
    }

    // Default to current month if not specified
    if (!timeMin || !timeMax) {
      const now = new Date();
      timeMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      timeMax = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
    }

    this.log(`Fetching events from ${timeMin} to ${timeMax}`);

    try {
      const response = await window.gapi.client.calendar.events.list({
        'calendarId': 'primary',
        'timeMin': timeMin,
        'timeMax': timeMax,
        'showDeleted': false,
        'singleEvents': true,
        'maxResults': 50,
        'orderBy': 'startTime'
      });

      this.log(`Received ${response.result.items?.length || 0} events`);
      return response.result;
    } catch (error) {
      this.log(`Error fetching calendar events: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch events from all calendars
   */
  async fetchAllCalendarEvents(timeMin, timeMax) {
    this.log("Fetching events from all calendars...");
    
    if (!this.gapiInited || !this.isAuthenticated) {
      const error = "Cannot fetch events: not initialized or not authenticated";
      this.log(error);
      throw new Error(error);
    }

    // Default to current month if not specified
    if (!timeMin || !timeMax) {
      const now = new Date();
      timeMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      timeMax = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
    }

    try {
      // First, get list of all calendars
      const calendarResponse = await window.gapi.client.calendar.calendarList.list();
      const calendars = calendarResponse.result.items || [];
      this.log(`Found ${calendars.length} calendars`);
      
      // Fetch events from each calendar
      let allEvents = [];
      let allCalendarData = { calendars: [] };
      
      for (const calendar of calendars) {
        try {
          this.log(`Fetching events from calendar: ${calendar.summary}`);
          const response = await window.gapi.client.calendar.events.list({
            'calendarId': calendar.id,
            'timeMin': timeMin,
            'timeMax': timeMax,
            'showDeleted': false,
            'singleEvents': true,
            'maxResults': 50,
            'orderBy': 'startTime'
          });
          
          const calendarEvents = response.result.items || [];
          this.log(`- Found ${calendarEvents.length} events in ${calendar.summary}`);
          
          // Add calendar info to events
          const eventsWithSource = calendarEvents.map(event => ({
            ...event,
            calendarId: calendar.id,
            calendarName: calendar.summary,
            calendarColor: calendar.backgroundColor
          }));
          
          allEvents = [...allEvents, ...eventsWithSource];
          allCalendarData.calendars.push({
            id: calendar.id,
            name: calendar.summary,
            color: calendar.backgroundColor,
            events: response.result
          });
        } catch (error) {
          this.log(`Error fetching events from ${calendar.summary}: ${error.message}`);
        }
      }
      
      // Sort all events by start time
      allEvents.sort((a, b) => {
        const aTime = a.start.dateTime || a.start.date;
        const bTime = b.start.dateTime || b.start.date;
        return new Date(aTime) - new Date(bTime);
      });
      
      this.log(`Combined ${allEvents.length} events from all calendars`);
      
      // Store comprehensive calendar data
      allCalendarData.allEvents = allEvents;
      return allCalendarData;
    } catch (error) {
      this.log(`Error fetching calendars: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add an event to Google Calendar
   */
  async addEventToCalendar(event, calendarId = 'primary') {
    this.log(`Adding event to calendar ${calendarId}...`);
    
    if (!this.gapiInited || !this.isAuthenticated) {
      const error = "Cannot add event: not initialized or not authenticated";
      this.log(error);
      throw new Error(error);
    }

    try {
      const response = await window.gapi.client.calendar.events.insert({
        calendarId: calendarId,
        resource: event
      });
      
      this.log(`Event added successfully: ${response.result.htmlLink}`);
      return response.result;
    } catch (error) {
      this.log(`Error adding event: ${error.message}`);
      throw error;
    }
  }

  /**
   * Format a Quad event into Google Calendar event format
   */
  formatQuadEventForGoogle(quadEvent) {
    return {
      summary: quadEvent.title,
      description: quadEvent.description || '',
      location: quadEvent.location || '',
      start: {
        dateTime: new Date(quadEvent.startTime).toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: new Date(quadEvent.endTime).toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };
  }

  /**
   * Check if the user is already signed in with improved reliability
   */
  async checkIfSignedIn() {
    try {
      // Ensure API is initialized
      if (!window.gapi || !window.gapi.client) {
        await this.ensureInitialized();
        if (!window.gapi || !window.gapi.client) {
// console.log("GAPI client still not initialized");
          return false;
        }
      }
      
      // First check current token
      let token = window.gapi.client.getToken();
      
      // If no token in client, check localStorage
      if (!token) {
// console.log("No token in client, checking localStorage");
        const storedToken = this.retrieveStoredToken();
        
        if (storedToken && storedToken.access_token) {
// console.log("Found token in localStorage");
          
          // Check if token has expired
          if (storedToken.expires_at && Date.now() < storedToken.expires_at) {
// console.log("Stored token is still valid");
            window.gapi.client.setToken(storedToken);
            token = storedToken;
          } else {
// console.log("Stored token has expired");
            this.clearStoredToken();
          }
        }
      }
      
      if (!token) {
// console.log("No valid token found");
        this.isAuthenticated = false;
        return false;
      }
      
      // Verify token with API call
      try {
        await window.gapi.client.calendar.calendarList.list({
          maxResults: 1
        });
// console.log("Token verified with successful API call");
        
        this.isAuthenticated = true;
        return true;
      } catch (apiError) {
        console.error("API call with token failed:", apiError);
        
        // Handle 401 errors
        if (apiError.result?.error?.code === 401) {
// console.log("Token is invalid or expired, clearing it");
          window.gapi.client.setToken(null);
          this.clearStoredToken();
          this.isAuthenticated = false;
          return false;
        }
        
        // For other errors, assume token is still valid
        this.isAuthenticated = true;
        return true;
      }
    } catch (error) {
      console.error("Error checking sign-in status:", error);
      return false;
    }
  }

  /**
   * Store the token in local storage
   */
  storeToken(token) {
    if (!token) return;
    
    try {
      localStorage.setItem('googleCalendarToken', JSON.stringify(token));
      this.log('Token stored in local storage');
    } catch (error) {
      this.log(`Failed to store token: ${error.message}`);
    }
  }

  /**
   * Retrieve the token from local storage
   */
  retrieveStoredToken() {
    try {
      const storedToken = localStorage.getItem('googleCalendarToken');
      if (storedToken) {
        return JSON.parse(storedToken);
      }
    } catch (error) {
      this.log(`Failed to retrieve token: ${error.message}`);
    }
    return null;
  }

  /**
   * Clear the stored token
   */
  clearStoredToken() {
    try {
      localStorage.removeItem('googleCalendarToken');
      this.log('Token removed from local storage');
    } catch (error) {
      this.log(`Failed to remove token: ${error.message}`);
    }
  }

  /**
   * Find or create "The Quad" calendar
   * @returns {Promise<string>} The calendar ID
   */
  async findOrCreateQuadCalendar() {
    try {
      this.log("Looking for 'The Quad' calendar...");
      
      if (!this.isAuthenticated) {
        throw new Error("User is not authenticated with Google Calendar");
      }
      
      // First check if "The Quad" calendar already exists
      const response = await window.gapi.client.calendar.calendarList.list();
      const calendars = response.result.items || [];
      
      // Look for a calendar named "The Quad"
      const quadCalendar = calendars.find(cal => cal.summary === "The Quad");
      
      if (quadCalendar) {
        this.log("Found existing 'The Quad' calendar");
        return quadCalendar.id;
      }
      
      // If not found, create it
      this.log("Creating 'The Quad' calendar...");
      const newCalendar = await window.gapi.client.calendar.calendars.insert({
        resource: {
          summary: "The Quad",
          description: "Events from The Quad campus platform",
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      });
      
      this.log("'The Quad' calendar created successfully");
      return newCalendar.result.id;
    } catch (error) {
      this.log(`Error finding/creating 'The Quad' calendar: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add an event to "The Quad" calendar
   * @param {Object} eventData The event data from The Quad
   * @returns {Promise<Object>} The created calendar event
   */
  async addRsvpToCalendar(eventData) {
    try {
      this.log("Adding RSVP'd event to Google Calendar...");
      
      if (!this.isAuthenticated) {
        throw new Error("User is not authenticated with Google Calendar");
      }
      
      // Find or create "The Quad" calendar
      const calendarId = await this.findOrCreateQuadCalendar();
      
      // Format the event for Google Calendar
      const googleEvent = this.formatQuadRsvpForGoogle(eventData);
      
      // Add the event to the calendar
      const response = await window.gapi.client.calendar.events.insert({
        calendarId: calendarId,
        resource: googleEvent
      });
      
      this.log("Event added to Google Calendar successfully");
      return response.result;
    } catch (error) {
      this.log(`Error adding event to calendar: ${error.message}`);
      throw error;
    }
  }

  /**
   * Format a RSVP'd event for Google Calendar
   * @param {Object} eventData The event data from RSVP
   */
  formatQuadRsvpForGoogle(eventData) {
    // Create a location string from available data
    const location = eventData.customLocation || eventData.landmarkName || '';
    
    // Create a description that includes the original event and RSVP details
    let description = eventData.description || '';
    description += `\n\nRSVP'd via The Quad campus platform.`;
    if (eventData.organizationName) {
      description += `\nHosted by: ${eventData.organizationName}`;
    }
    
    return {
      summary: eventData.title,
      description: description,
      location: location,
      start: {
        dateTime: new Date(eventData.startDate).toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: new Date(eventData.endDate).toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      colorId: "5", // A purple color in Google Calendar
      // Add reminders
      reminders: {
        useDefault: false,
        overrides: [
          {method: 'popup', minutes: 30},
          {method: 'email', minutes: 60 * 24} // 1 day before
        ]
      }
    };
  }

  /**
   * Add a method to ensure initialization is complete with improved handling
   */
  async ensureInitialized() {
    if (this.gapiInited && this.gisInited) {
      await this.restoreAuthState();
      return true;
    }
    
    this.log("APIs not fully initialized, initializing now...");
    try {
      await this.initialize();
      return this.gapiInited && this.gisInited;
    } catch (error) {
      this.log(`Initialization failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Synchronize calendar events with RSVP data
   * @param {boolean} force Whether to force sync even if recently synced
   */
  async syncCalendarWithRsvp(force = false) {
    // Prevent syncing too frequently
    const now = Date.now();
    if (!force && this._lastSyncTime && (now - this._lastSyncTime < 30000)) {
      this.log("Skipping sync - last sync was less than 30 seconds ago");
      return;
    }
    
    // Set last sync time
    this._lastSyncTime = now;
    
    try {
      this.log("Starting calendar synchronization...");
      
      if (!this.isAuthenticated) {
        throw new Error("User is not authenticated with Google Calendar");
      }
      
      // Get "The Quad" calendar ID
      const calendarId = await this.findOrCreateQuadCalendar();
      this.log(`Using calendar ID: ${calendarId}`);
      
      // Fetch all events from "The Quad" calendar
      const calendarEventsResponse = await window.gapi.client.calendar.events.list({
        calendarId: calendarId,
        timeMin: new Date(new Date().getTime() - 31536000000).toISOString(), // 1 year ago
        timeMax: new Date(new Date().getTime() + 31536000000).toISOString(), // 1 year in future
        singleEvents: true
      });
      
      const calendarEvents = calendarEventsResponse.result.items || [];
      this.log(`Found ${calendarEvents.length} events in The Quad calendar`);
// console.log("Calendar Events:", calendarEvents);
      
      // Use local data directly instead of calling the failing API endpoint
      let rsvpEvents = [];
      
      // Get pending event from localStorage
      const pendingEvent = localStorage.getItem('pendingCalendarEvent');
      if (pendingEvent) {
        try {
          const parsedEvent = JSON.parse(pendingEvent);
          this.log("Using pending event from localStorage");
// console.log("Using pending event:", parsedEvent);
          rsvpEvents.push(parsedEvent);
          
          // Check if the event is already in the calendar
          const eventExists = calendarEvents.some(calEvent => 
            calEvent.summary === parsedEvent.title
          );
          
          if (eventExists) {
            // Event is already in calendar, remove from localStorage
            this.log("Event already in calendar, clearing from localStorage");
            localStorage.removeItem('pendingCalendarEvent');
          }
        } catch (parseError) {
          this.log(`Failed to parse pending event: ${parseError.message}`);
        }
      }
      
      this.log(`Using ${rsvpEvents.length} RSVP'd events from local data`);
// console.log("RSVP Events:", rsvpEvents);
      
      // Add events that are in RSVP but not in calendar
      for (const rsvpEvent of rsvpEvents) {
        // Check if event exists in calendar
        const eventExists = calendarEvents.some(calendarEvent => calendarEvent.summary === rsvpEvent.title);
        
        if (!eventExists) {
          this.log(`Event "${rsvpEvent.title}" not found in calendar, adding...`);
          try {
            await this.addRsvpToCalendar(rsvpEvent);
            this.log(`Successfully added event "${rsvpEvent.title}" to calendar`);
            
            // Clear from localStorage after successful add
            localStorage.removeItem('pendingCalendarEvent');
          } catch (addError) {
            this.log(`Failed to add event "${rsvpEvent.title}" to calendar: ${addError.message}`);
            console.error("Add error details:", addError);
          }
        } else {
          this.log(`Event "${rsvpEvent.title}" already exists in calendar`);
          
          // Still clear from localStorage as it's already in calendar
          localStorage.removeItem('pendingCalendarEvent');
        }
      }
      
      this.log("Calendar synchronization complete");
    } catch (error) {
      this.log(`Calendar synchronization error: ${error.message}`);
      console.error("Calendar sync error:", error);
    }
  }

  /**
   * Fetch RSVP'd events from the backend
   * @returns {Promise<Array>} List of events
   */
  async fetchRsvpEventsFromBackend() {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error("No authentication token found");
      }
      
      // First try to get from the backend API endpoint
      try {
        this.log("Attempting to fetch from RSVP API endpoint...");
        const response = await fetch(`${API_URL}/api/events/rsvps`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const responseData = await response.json().catch(e => ({ success: false, error: "Invalid JSON response" }));
        
        if (response.ok && responseData.success && Array.isArray(responseData.rsvps)) {
          this.log(`Fetched ${responseData.rsvps.length} RSVP'd events from backend`);
// console.log("RSVP Events:", responseData.rsvps);
          
          // Extract just the event data from each RSVP
          return responseData.rsvps.map(rsvp => rsvp.event);
        } else {
          this.log(`API returned status ${response.status}, error: ${responseData.error || "Unknown error"}`);
          this.log("Falling back to local data");
        }
      } catch (fetchError) {
        this.log(`API fetch error: ${fetchError.message}, falling back to local data`);
      }
      
      // Then try to get from localStorage if API failed
      const pendingEvent = localStorage.getItem('pendingCalendarEvent');
      if (pendingEvent) {
        try {
          const eventData = JSON.parse(pendingEvent);
          this.log("Using pending event from localStorage");
// console.log("Using pending event:", eventData);
          
          // Return the pending event
          return [eventData];
        } catch (parseError) {
          this.log("Failed to parse pending event");
        }
      }
      
      this.log("No RSVP data available");
      return [];
    } catch (error) {
      this.log(`Error fetching RSVP events from backend: ${error.message}`);
      console.error("Backend fetch error:", error);
      return [];
    }
  }
}

// Create singleton instance
const calendarController = new CalendarController();
export default calendarController;