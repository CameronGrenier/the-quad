/**
 * CalendarController - Manages Google Calendar integration
 */
class CalendarController {
  constructor() {
    this.GOOGLE_API_KEY = process.env.REACT_APP_GOOGLE_API_KEY || 'AIzaSyCT7Oi6lj9KCLeJ8khaNyv_-rziY6oMcjo';
    this.GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '1018555477374-es86bnf9he036bbt7it7s8d2llk9sh75.apps.googleusercontent.com';
    
    this.gapiInited = false;
    this.gisInited = false;
    this.isAuthenticated = false;
    this.tokenClient = null;
    this.listeners = {
      onLog: () => {},
      onAuthChange: () => {},
      onError: () => {},
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
    console.log(message);
  }

  /**
   * Initialize Google API libraries
   */
  async initialize() {
    this.log("Initializing Google Calendar integration...");
    
    try {
      // Load the GAPI script
      await this.loadGapiScript();
      // Load the GIS script
      await this.loadGisScript();
      
      // Try to restore token from localStorage
      const storedToken = this.retrieveStoredToken();
      if (storedToken && storedToken.access_token) {
        this.log("Found stored token, attempting to restore");
        
        // Check if token has expired
        if (storedToken.expires_at && Date.now() < storedToken.expires_at) {
          window.gapi.client.setToken(storedToken);
          this.log("Restored token from storage");
        } else {
          this.log("Stored token has expired");
          this.clearStoredToken();
        }
      }
    } catch (error) {
      this.listeners.onError?.(error.message);
    }
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
        apiKey: this.GOOGLE_API_KEY,
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
        client_id: this.GOOGLE_CLIENT_ID,
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
   * Request access token from Google
   */
  signIn() {
    this.log("Requesting access token...");
    
    if (!this.gapiInited || !this.gisInited) {
      const error = "Google APIs are not fully initialized";
      this.log(error);
      this.listeners.onError?.(error);
      return false;
    }

    this.tokenClient.requestAccessToken();
    return true;
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
   * Check if the user is already signed in
   */
  async checkIfSignedIn() {
    try {
      // Check if gapi client is initialized
      if (!window.gapi || !window.gapi.client) {
        console.log("GAPI client not initialized");
        return false;
      }
      
      // First check current token
      let token = window.gapi.client.getToken();
      
      // If no token in client, check localStorage
      if (!token) {
        console.log("No token in client, checking localStorage");
        const storedToken = this.retrieveStoredToken();
        
        if (storedToken && storedToken.access_token) {
          console.log("Found token in localStorage");
          
          // Check if token has expired
          if (storedToken.expires_at && Date.now() < storedToken.expires_at) {
            console.log("Stored token is still valid");
            window.gapi.client.setToken(storedToken);
            token = storedToken;
          } else {
            console.log("Stored token has expired");
            this.clearStoredToken();
          }
        }
      }
      
      if (!token) {
        console.log("No valid token found");
        return false;
      }
      
      console.log("Found token, verifying with API call");
      
      // Verify token with API call
      try {
        await window.gapi.client.calendar.calendarList.list({
          maxResults: 1
        });
        console.log("Token verified with successful API call");
        
        this.isAuthenticated = true;
        return true;
      } catch (apiError) {
        console.error("API call with token failed:", apiError);
        
        if (apiError.result && apiError.result.error && apiError.result.error.code === 401) {
          console.log("Token is invalid or expired, clearing it");
          window.gapi.client.setToken(null);
          this.clearStoredToken();
          this.isAuthenticated = false;
          return false;
        }
        
        // For other errors (network etc.), assume token is still valid
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
}

// Create singleton instance
const calendarController = new CalendarController();
export default calendarController;