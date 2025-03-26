// This test demonstrates end-to-end API testing with Miniflare

import { Miniflare } from "miniflare";

describe('API Integration Tests', () => {
  let mf;
  let authToken;
  
  beforeAll(async () => {
    // Setup Miniflare environment
    mf = new Miniflare({
      scriptPath: "./client/src/worker.js",
      modules: true,
      bindings: {
        // Mock any bindings needed
        REACT_APP_GOOGLE_MAPS_API_KEY: "mock-api-key",
      },
      d1Databases: ["D1_DB"], // Creates a temporary D1 database
      r2Buckets: ["R2_BUCKET"], // Creates a temporary R2 bucket
    });

    // Create sample data for testing
    const db = await mf.getD1Database("D1_DB");
    
    // Create users table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS USERS (
        userID INTEGER PRIMARY KEY,
        username TEXT UNIQUE,
        f_name TEXT,
        l_name TEXT,
        email TEXT UNIQUE,
        phone TEXT,
        password TEXT,
        profile_picture TEXT
      )
    `);
    
    // Create organization table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS ORGANIZATION (
        orgID INTEGER PRIMARY KEY,
        name TEXT UNIQUE,
        description TEXT,
        thumbnail TEXT,
        banner TEXT,
        privacy TEXT
      )
    `);
    
    // Create org_admin table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS ORG_ADMIN (
        orgID INTEGER,
        userID INTEGER,
        PRIMARY KEY (orgID, userID),
        FOREIGN KEY (orgID) REFERENCES ORGANIZATION(orgID),
        FOREIGN KEY (userID) REFERENCES USERS(userID)
      )
    `);
    
    // Create event table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS EVENT (
        eventID INTEGER PRIMARY KEY,
        title TEXT,
        description TEXT,
        organizationID INTEGER,
        startDate TEXT,
        endDate TEXT,
        thumbnail TEXT,
        banner TEXT,
        privacy TEXT,
        landmarkID INTEGER,
        FOREIGN KEY (organizationID) REFERENCES ORGANIZATION(orgID)
      )
    `);
    
    // Create other necessary tables
    await db.exec(`CREATE TABLE IF NOT EXISTS OFFICIAL_ORGS (
      orgID INTEGER PRIMARY KEY,
      FOREIGN KEY (orgID) REFERENCES ORGANIZATION(orgID)
    )`);
    
    await db.exec(`CREATE TABLE IF NOT EXISTS OFFICIAL_EVENTS (
      eventID INTEGER PRIMARY KEY,
      FOREIGN KEY (eventID) REFERENCES EVENT(eventID)
    )`);
    
    await db.exec(`CREATE TABLE IF NOT EXISTS PENDING_SUBMISSION (
      submissionID INTEGER PRIMARY KEY,
      orgID INTEGER,
      eventID INTEGER,
      FOREIGN KEY (orgID) REFERENCES ORGANIZATION(orgID),
      FOREIGN KEY (eventID) REFERENCES EVENT(eventID)
    )`);
    
    await db.exec(`CREATE TABLE IF NOT EXISTS LANDMARK (
      landmarkID INTEGER PRIMARY KEY,
      name TEXT,
      location TEXT,
      multiEventAllowed INTEGER
    )`);
  });
  
  afterAll(async () => {
    await mf.dispose();
  });

  // Test full user journey
  describe('User Journey', () => {
    test('should sign up, log in, create organization and event', async () => {
      // Test signup
      const signupResponse = await mf.dispatchFetch("https://test.org/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          f_name: "Test",
          l_name: "User",
          username: "testuser",
          email: "test@example.com",
          password: "password123"
        })
      });
      
      const signupData = await signupResponse.json();
      expect(signupData.success).toBe(true);
      expect(signupData.token).toBeDefined();
      authToken = signupData.token;
      
      // Test login
      const loginResponse = await mf.dispatchFetch("https://test.org/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123"
        })
      });
      
      const loginData = await loginResponse.json();
      expect(loginData.success).toBe(true);
      expect(loginData.token).toBeDefined();
      
      // Test create organization
      const formData = new FormData();
      formData.append('name', 'Test Organization');
      formData.append('description', 'Test Description');
      formData.append('userID', signupData.user.id);
      formData.append('privacy', 'public');
      
      const orgResponse = await mf.dispatchFetch("https://test.org/api/register-organization", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${authToken}`
        },
        body: formData
      });
      
      const orgData = await orgResponse.json();
      expect(orgData.success).toBe(true);
      expect(orgData.orgID).toBeDefined();
      
      // Test get organizations
      const getOrgsResponse = await mf.dispatchFetch("https://test.org/api/user-organizations", {
        headers: {
          "Authorization": `Bearer ${authToken}`
        }
      });
      
      const getOrgsData = await getOrgsResponse.json();
      expect(getOrgsData.success).toBe(true);
      expect(getOrgsData.organizations).toBeInstanceOf(Array);
      expect(getOrgsData.organizations.length).toBeGreaterThan(0);
      
      // Test create event
      const eventFormData = new FormData();
      eventFormData.append('title', 'Test Event');
      eventFormData.append('description', 'Test Event Description');
      eventFormData.append('organizationID', orgData.orgID);
      eventFormData.append('startDate', new Date().toISOString());
      eventFormData.append('endDate', new Date(Date.now() + 86400000).toISOString());
      eventFormData.append('privacy', 'public');
      
      const eventResponse = await mf.dispatchFetch("https://test.org/api/register-event", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${authToken}`
        },
        body: eventFormData
      });
      
      const eventData = await eventResponse.json();
      expect(eventData.success).toBe(true);
      expect(eventData.eventID).toBeDefined();
    });
  });

  // Test error cases
  describe('Error Handling', () => {
    test('should return 404 for nonexistent endpoint', async () => {
      const response = await mf.dispatchFetch("https://test.org/api/nonexistent");
      expect(response.status).toBe(404);
      
      const data = await response.json();
      expect(data.error).toBe("Not found");
    });
    
    test('should return error for invalid login', async () => {
      const response = await mf.dispatchFetch("https://test.org/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "wrong@example.com",
          password: "wrongpassword"
        })
      });
      
      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });
});