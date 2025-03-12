export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Define CORS headers inside the fetch function
    const corsHeaders = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // Handle OPTIONS requests for CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders,
      });
    }

    try {
      // Basic routing
      if (path === "/api/register-organization" && request.method === "POST") {
        return await registerOrganization(request, env, corsHeaders);
      } else if (path === "/api/check-organization-name") {
        return await checkOrganizationName(request, env, corsHeaders);
      } else if (path === "/api/signup" && request.method === "POST") {
        return await signup(request, env, corsHeaders);
      } else if (path === "/api/login" && request.method === "POST") {
        return await login(request, env, corsHeaders);
      } else if (path === "/api/check-email") {
        return await checkEmailExists(request, env, corsHeaders);
      } else if (path === "/api/user-organizations") {
        return await getUserOrganizations(request, env, corsHeaders);
      } else if (path === "/api/landmarks") {
        return await getLandmarks(env, corsHeaders);
      } else if (path === "/api/check-landmark-availability" && request.method === "POST") {
        return await checkLandmarkAvailability(request, env, corsHeaders);
      } else if (path === "/api/register-event" && request.method === "POST") {
        return await registerEvent(request, env, corsHeaders);
      } else if (path.startsWith("/images/")) {
        const imagePath = path.replace("/images/", "");
        return await serveImageFromR2(env, imagePath, corsHeaders);
      } else {
        // Default response: include CORS headers even if not found.
        return new Response("Not found", {
          status: 404,
          headers: corsHeaders,
        });
      }
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  }
};

// Function to register an organization
async function registerOrganization(request, env, corsHeaders) {
  try {
    // Parse form data from the multipart request
    const formData = await parseFormData(request);
    
    // Get required fields
    const name = formData.get('name');
    const description = formData.get('description') || '';
    const userID = formData.get('userID');
    const privacy = formData.get('privacy') || 'public';
    const submitForOfficialStatus = formData.get('submitForOfficialStatus') === 'true';
    
    // Validate required fields
    if (!name || !userID) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Name and userID are required fields'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }
    
    // Check if organization name already exists
    const existingOrg = await env.DB.prepare(
      'SELECT * FROM ORGANIZATION WHERE name = ?'
    ).bind(name).get();
    
    if (existingOrg) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Organization name already exists'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }
    
    // Process file uploads for thumbnail and banner if provided
    let thumbnailURL = '';
    let bannerURL = '';
    
    // Handle thumbnail upload
    const thumbnail = formData.get('thumbnail');
    if (thumbnail && thumbnail.size > 0) {
      thumbnailURL = await uploadFileToR2(env, thumbnail, `organizations/thumbnails/${name}-${Date.now()}`);
    }
    
    // Handle banner upload
    const banner = formData.get('banner');
    if (banner && banner.size > 0) {
      bannerURL = await uploadFileToR2(env, banner, `organizations/banners/${name}-${Date.now()}`);
    }
    
    // Create the organization in the database using a transaction
    const result = await env.DB.prepare(`
      BEGIN TRANSACTION;
      
      INSERT INTO ORGANIZATION (name, description, thumbnail, banner, privacy, officialStatus) 
      VALUES (?, ?, ?, ?, ?, ?);
      
      -- Get the last inserted row ID
      SELECT last_insert_rowid() as orgID;
      
      COMMIT;
    `).bind(
      name,
      description,
      thumbnailURL,
      bannerURL,
      privacy,
      submitForOfficialStatus ? 1 : 0
    ).all();
    
    // Get the newly created organization ID
    const newOrgID = result.results[1].orgID;
    
    // Add the creator as an admin of the organization
    await env.DB.prepare(`
      INSERT INTO ORGANIZATION_ADMIN (orgID, userID)
      VALUES (?, ?)
    `).bind(newOrgID, userID).run();
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Organization created successfully',
      orgID: newOrgID
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Error creating organization:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to create organization'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

// Function to check if an organization name exists
async function checkOrganizationName(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const name = url.searchParams.get('name');

    const { results } = await env.D1_DB.prepare(
      "SELECT * FROM organization WHERE LOWER(name) = LOWER(?)"
    ).bind(name).all();

    const exists = results && results.length > 0;

    return new Response(JSON.stringify({ success: true, exists }), {
      headers: corsHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

// Function to serve images from R2
async function serveImageFromR2(env, imagePath, corsHeaders) {
  try {
    const object = await env.R2_BUCKET.get(imagePath);

    if (object === null) {
      return new Response("Image not found", {
        status: 404,
        headers: corsHeaders, // Apply CORS headers here
      });
    }

    const contentType = getContentTypeFromPath(imagePath);

    return new Response(object.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  } catch (error) {
    return new Response(`Error serving image: ${error.message}`, {
      status: 500,
      headers: corsHeaders, // And here
    });
  }
}

// Helper function to determine content type from file path
function getContentTypeFromPath(path) {
  const extension = path.split('.').pop().toLowerCase();
  const contentTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp'
  };
  return contentTypes[extension] || 'application/octet-stream';
}

// Function to handle user signup
async function signup(request, env, corsHeaders) {
  try {
    const data = await request.json();
    const { f_name, l_name, email, phone, password } = data;
    
    // Check if user already exists
    const { results: existingUser } = await env.D1_DB.prepare(
      "SELECT * FROM users WHERE LOWER(email) = LOWER(?)"
    ).bind(email).all();
    
    if (existingUser && existingUser.length > 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "A user with this email already exists" 
      }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    
    // Hash the password (in a real app, use bcrypt or similar)
    // Since we can't use bcrypt in Cloudflare Workers, we'll use a simpler hash for now
    // In production, use Workers KV or similar to store auth tokens instead
    const hashedPassword = await hashPassword(password);
    
    // Insert user into database
    const result = await env.D1_DB.prepare(
      "INSERT INTO users (f_name, l_name, email, phone, password) VALUES (?, ?, ?, ?, ?)"
    ).bind(f_name, l_name, email, phone, hashedPassword).run();
    
    // Generate a JWT token for the user
    const token = generateJWT({ email, userId: result.meta.last_row_id });
    
    return new Response(JSON.stringify({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: result.meta.last_row_id,
        f_name,
        l_name,
        email,
        phone
      }
    }), {
      headers: corsHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

// Function to handle user login
async function login(request, env, corsHeaders) {
  try {
    const data = await request.json();
    const { email, password } = data;
    
    // Find user
    const { results: users } = await env.D1_DB.prepare(
      "SELECT * FROM users WHERE LOWER(email) = LOWER(?)"
    ).bind(email).all();
    
    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Invalid email or password" 
      }), {
        status: 401,
        headers: corsHeaders,
      });
    }
    
    const user = users[0];
    
    // Check password
    const passwordMatch = await verifyPassword(password, user.password);
    if (!passwordMatch) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Invalid email or password" 
      }), {
        status: 401,
        headers: corsHeaders,
      });
    }
    
    // Generate a JWT token
    const token = generateJWT({ email: user.email, userId: user.userID });
    
    return new Response(JSON.stringify({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.userID,
        f_name: user.f_name,
        l_name: user.l_name,
        email: user.email,
        phone: user.phone,
        profile_picture: user.profile_picture
      }
    }), {
      headers: corsHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

// Function to check if email exists
async function checkEmailExists(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');

    const { results } = await env.D1_DB.prepare(
      "SELECT * FROM users WHERE LOWER(email) = LOWER(?)"
    ).bind(email).all();

    const exists = results && results.length > 0;

    return new Response(JSON.stringify({ success: true, exists }), {
      headers: corsHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

// Simple password hashing function (for demo purposes - use proper hashing in production)
async function hashPassword(password) {
  // In a production environment, use a proper hashing library
  // This is a very basic hash for demonstration only
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "some-salt-value");
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Simple password verification
async function verifyPassword(password, hashedPassword) {
  const hash = await hashPassword(password);
  return hash === hashedPassword;
}

// Generate JWT token
function generateJWT(payload) {
  // In a production environment, use proper JWT library or Cloudflare Workers JWT functionality
  // This is a very basic implementation for demonstration
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };
  
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 60 * 60 * 24; // 24 hours
  
  payload = {
    ...payload,
    iat: now,
    exp: now + expiresIn
  };
  
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  
  // In a real implementation, you would sign this properly
  // This is just for demonstration
  const signature = btoa(`${encodedHeader}.${encodedPayload}-signature`);
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

// Function to get organizations where user is admin
async function getUserOrganizations(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const userID = url.searchParams.get('userID');

    if (!userID) {
      return new Response(JSON.stringify({ success: false, error: "User ID is required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Query organizations where the user is an admin
    const { results } = await env.D1_DB.prepare(`
      SELECT o.* FROM organization o
      JOIN organization_user ou ON o.orgID = ou.orgID
      WHERE ou.userID = ? AND ou.role = 'admin'
    `).bind(userID).all();

    return new Response(JSON.stringify({ success: true, organizations: results || [] }), {
      headers: corsHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

// Function to handle retrieving landmarks
async function getLandmarks(env, corsHeaders) {
  try {
    // For now, return an empty array since you mentioned the table isn't populated
    // When you add data, you can replace this with a real query
    /* 
    const result = await env.DB.prepare(`
      SELECT * FROM LANDMARK
    `).all();
    
    return new Response(JSON.stringify({
      success: true,
      landmarks: result.results || []
    }), {
      headers: corsHeaders
    });
    */
    
    // Return empty array for now since you said the table is not populated
    return new Response(JSON.stringify({
      success: true,
      landmarks: []
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error("Error in getLandmarks:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || "Failed to retrieve landmarks"
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

// Make sure to add a stub for the landmark availability check too
async function checkLandmarkAvailability(request, env, corsHeaders) {
  try {
    // Since we don't have real landmarks yet, just return available: true
    return new Response(JSON.stringify({
      success: true,
      available: true
    }), {
      headers: corsHeaders
    });
    
    /* Uncomment this when you have real landmarks and events
    const { landmarkID, startDate, endDate } = await request.json();
    
    if (!landmarkID || !startDate || !endDate) {
      return new Response(JSON.stringify({
        success: false,
        error: "Missing required parameters"
      }), {
        status: 400,
        headers: corsHeaders
      });
    }
    
    // Check if landmark exists
    const landmarkCheck = await env.DB.prepare(`
      SELECT * FROM LANDMARK WHERE landmarkID = ?
    `).bind(landmarkID).get();
    
    if (!landmarkCheck) {
      return new Response(JSON.stringify({
        success: false,
        error: "Landmark not found"
      }), {
        status: 404,
        headers: corsHeaders
      });
    }
    
    // Check if the landmark allows multiple events
    const multiEventAllowed = landmarkCheck.multiEventAllowed;
    
    if (multiEventAllowed) {
      // If multiple events are allowed, always available
      return new Response(JSON.stringify({
        success: true,
        available: true
      }), {
        headers: corsHeaders
      });
    }
    
    // Check if there are any conflicting events
    const conflicts = await env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM EVENT
      WHERE landmarkID = ?
      AND (
        (startDate <= ? AND endDate >= ?) OR
        (startDate <= ? AND endDate >= ?) OR
        (startDate >= ? AND endDate <= ?)
      )
    `).bind(
      landmarkID,
      endDate, startDate,     // Event ends during our start
      startDate, endDate,     // Event starts during our end
      startDate, endDate      // Event is completely inside our timeframe
    ).get();
    
    const available = conflicts.count === 0;
    
    return new Response(JSON.stringify({
      success: true,
      available
    }), {
      headers: corsHeaders
    });
    */
  } catch (error) {
    console.error("Error in checkLandmarkAvailability:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || "Failed to check landmark availability"
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

// Function to register an event
async function registerEvent(request, env, corsHeaders) {
  try {
    // Parse form data from the multipart request
    const formData = await parseFormData(request);
    
    // Get required fields
    const organizationID = formData.get('organizationID');
    const title = formData.get('title');
    const description = formData.get('description') || '';
    const startDate = formData.get('startDate');
    const endDate = formData.get('endDate');
    const privacy = formData.get('privacy') || 'public';
    const submitForOfficialStatus = formData.get('submitForOfficialStatus') === 'true';
    const landmarkID = formData.get('landmarkID') || null;
    const customLocation = formData.get('customLocation') || '';
    const userID = formData.get('userID'); // The user creating the event
    
    // Validate required fields
    if (!organizationID || !title || !startDate || !endDate || !userID) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Organization ID, title, start date, end date and user ID are required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }
    
    // Verify that the user is an admin of the organization
    const isAdmin = await env.DB.prepare(`
      SELECT 1 FROM ORGANIZATION_ADMIN 
      WHERE orgID = ? AND userID = ?
    `).bind(organizationID, userID).get();
    
    if (!isAdmin) {
      return new Response(JSON.stringify({
        success: false,
        error: 'User is not an admin of this organization'
      }), {
        status: 403,
        headers: corsHeaders
      });
    }
    
    // Check landmark availability if provided
    if (landmarkID) {
      const landmarkAvailabilityCheck = await checkLandmarkAvailability(
        new Request('', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ landmarkID, startDate, endDate }),
        }),
        env,
        corsHeaders
      );
      
      const availabilityData = await landmarkAvailabilityCheck.json();
      
      if (!availabilityData.available) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Selected landmark is not available for the specified time period" 
        }), {
          status: 400,
          headers: corsHeaders,
        });
      }
    }
    
    // Process file uploads for thumbnail and banner if provided
    let thumbnailURL = '';
    let bannerURL = '';
    
    // Handle thumbnail upload
    const thumbnail = formData.get('thumbnail');
    if (thumbnail && thumbnail.size > 0) {
      thumbnailURL = await uploadFileToR2(env, thumbnail, `events/thumbnails/${title}-${Date.now()}`);
    }
    
    // Handle banner upload
    const banner = formData.get('banner');
    if (banner && banner.size > 0) {
      bannerURL = await uploadFileToR2(env, banner, `events/banners/${title}-${Date.now()}`);
    }
    
    // Create the event in the database using a transaction
    const result = await env.DB.prepare(`
      BEGIN TRANSACTION;
      
      INSERT INTO EVENT (
        organizationID, title, description, thumbnail, banner, 
        startDate, endDate, privacy, officialStatus, landmarkID,
        customLocation
      ) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      
      -- Get the last inserted row ID
      SELECT last_insert_rowid() as eventID;
      
      COMMIT;
    `).bind(
      organizationID,
      title,
      description,
      thumbnailURL,
      bannerURL,
      startDate,
      endDate,
      privacy,
      submitForOfficialStatus ? 1 : 0,
      landmarkID,
      customLocation
    ).all();
    
    // Get the newly created event ID
    const newEventID = result.results[1].eventID;
    
    // Add the creator as an admin of the event
    await env.DB.prepare(`
      INSERT INTO EVENT_ADMIN (eventID, userID)
      VALUES (?, ?)
    `).bind(newEventID, userID).run();
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Event created successfully',
      eventID: newEventID
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Error creating event:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to create event'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}