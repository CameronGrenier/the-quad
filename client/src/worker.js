/**
 * The Quad - University Event Planner - Cloudflare Worker
 *
 * This worker script handles API requests, database interactions (D1),
 * object storage (R2), authentication, and image serving.
 */

// ============================================================================
// UTILITY FUNCTIONS - Core cryptographic and data handling functions
// ============================================================================

/**
 * Parse multipart form data from a request
 * @param {Request} request - The incoming request with multipart form data
 * @returns {Promise<FormData>} - Parsed form data
 */
async function parseFormData(request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    return formData;
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await request.formData();
    return formData;
  } else if (contentType.includes('application/json')) {
    const json = await request.json();
    const formData = new FormData();

    // Convert JSON to FormData
    Object.entries(json).forEach(([key, value]) => {
      formData.append(key, value);
    });

    return formData;
  }

  // Default empty FormData if no recognized content type
  return new FormData();
}

/**
 * Generates a JWT (JSON Web Token) for user authentication.
 *
 * @param {object} payload - The payload to include in the JWT (e.g., user ID, email).
 * @returns {string} - The generated JWT.
 */
function generateJWT(payload) {
  // In production, use a real JWT library with proper signing
  // This is a simplified implementation for demonstration
  const header = {
    alg: "HS256",
    typ: "JWT"
  };

  // Set expiration to 24 hours from now
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 60 * 60 * 24; // 24 hours

  const jwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn
  };

  // Encode the parts using Base64
  const base64Header = btoa(JSON.stringify(header));
  const base64Payload = btoa(JSON.stringify(jwtPayload));

  // In a real implementation, you would sign this with a secret key
  // For now, we're using a placeholder signature
  const signature = btoa("thequadsignature");

  // Create the JWT
  return `${base64Header}.${base64Payload}.${signature}`;
}

/**
 * Hashes a password using SHA-256 for secure storage.
 *
 * @param {string} password - The password to hash.
 * @returns {Promise<string>} - A promise that resolves with the hashed password.
 */
async function hashPassword(password) {
  // In a production environment, use bcrypt or Argon2
  // For this demo, we'll use a simple hash with a salt
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "the-quad-salt");

  // Use the Web Crypto API for hashing
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Convert the hash to a hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * Verifies a password against a stored hash.
 *
 * @param {string} password - The plaintext password to verify.
 * @param {string} hashedPassword - The stored, hashed password to compare against.
 * @returns {Promise<boolean>} - A promise that resolves with true if the password matches, and false otherwise.
 */
async function verifyPassword(password, hashedPassword) {
  console.log("Verifying password:", {
    providedPassword: password,
    storedHashedPassword: hashedPassword
  });
  // Hash the provided password and compare with stored hash
  const passwordHash = await hashPassword(password);
  console.log("Hashed provided password:", passwordHash);
  return passwordHash === hashedPassword;
}

/**
 * Verifies a JWT token to ensure its authenticity and validity.
 *
 * @param {string} token - The JWT to verify.
 * @returns {object} - The payload of the JWT if it's valid.
 * @throws {Error} - If the token is invalid or expired.
 */
function verifyJWT(token) {
  try {
    // Split the token into parts
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    // Decode the payload part
    const payloadBase64 = parts[1];
    const payload = JSON.parse(atob(payloadBase64));

    // Check if token has expired
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new Error('Token has expired');
    }

    // In a real implementation, you would verify the signature here

    return payload;
  } catch (error) {
    throw new Error(`Invalid token: ${error.message}`);
  }
}

/**
 * Uploads a file to Cloudflare R2 storage.
 *
 * @param {object} env - The Cloudflare environment object, containing bindings.
 * @param {object} file - The file object to upload.
 * @param {string} path - The path within the R2 bucket to store the file.
 * @returns {Promise<string>} - A promise that resolves with the public URL of the uploaded file.
 * @throws {Error} - If the R2 bucket binding is missing or the upload fails.
 */
async function uploadFileToR2(env, file, path) {
  try {
    // Check if R2_BUCKET binding is configured
    if (!env.R2_BUCKET) {
      throw new Error("Missing R2_BUCKET binding in worker environment");
    }

    // Format the path correctly - we want it without a leading /images/
    // since the bucket itself is already named "images"
    const cleanPath = path;

    // Convert file to ArrayBuffer for upload
    const buffer = await file.arrayBuffer();

    // Determine content type from file
    const contentType = file.type || 'application/octet-stream';

    console.log(`Uploading file to R2 with path: ${cleanPath}, size: ${buffer.byteLength}, type: ${contentType}`);

    // Upload to R2 with the path directly to the bucket
    await env.R2_BUCKET.put(cleanPath, buffer, {
      httpMetadata: { contentType }
    });

    // This is the important change - return an absolute path with *single* /images/ prefix
    // The worker route already has /images/ in its prefix
    return `/images/${cleanPath}`;
  } catch (error) {
    console.error('Error uploading file to R2:', error);
    throw new Error(`File upload failed: ${error.message}`);
  }
}

// ============================================================================
// CORE WORKER FUNCTION - Handles incoming requests and routes them
// ============================================================================

export default {
  async fetch(request, env, ctx) {
    // CORS Headers to allow cross-origin requests
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "application/json"
    };

    // Handle preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders,
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ============================================================================
      // AUTHENTICATION ENDPOINTS - Signup, Login, User Profile
      // ============================================================================

      if (path === "/api/signup" && request.method === "POST") {
        return await signup(request, env, corsHeaders);
      }

      if (path === "/api/login" && request.method === "POST") {
        return await login(request, env, corsHeaders);
      }

      if (path === "/api/user-profile" && request.method === "GET") {
        return await getUserProfile(request, env, corsHeaders);
      }

      // ============================================================================
      // VALIDATION ENDPOINTS - Check Email, Organization Name
      // ============================================================================

      if (path === "/api/check-email" && request.method === "GET") {
        return await checkEmailExists(request, env, corsHeaders);
      }

      if (path === "/api/check-organization-name" && request.method === "GET") {
        return await checkOrganizationName(request, env, corsHeaders);
      }

      // ============================================================================
      // ORGANIZATION ENDPOINTS - Register, Get User Organizations
      // ============================================================================

      if (path === "/api/register-organization" && request.method === "POST") {
        return await registerOrganization(request, env, corsHeaders);
      }

      if (path === "/api/user-organizations" && request.method === "GET") {
        return await getUserOrganizations(request, env, corsHeaders);
      }

      // ============================================================================
      // EVENT ENDPOINTS - Register Event
      // ============================================================================

      if (path === "/api/register-event" && request.method === "POST") {
        return await registerEvent(request, env, corsHeaders);
      }

      // ============================================================================
      // LANDMARK ENDPOINTS - Get Landmarks, Check Availability
      // ============================================================================

      if (path === "/api/landmarks" && request.method === "GET") {
        return await getLandmarks(env, corsHeaders);
      }

      if (path === "/api/check-landmark-availability" && request.method === "POST") {
        return await checkLandmarkAvailability(request, env, corsHeaders);
      }

      // ============================================================================
      // DATABASE MANAGEMENT - Fix Schema, Diagnostics
      // ============================================================================

      if (path === "/api/fix-database-schema") {
        return await fixDatabaseSchema(env, corsHeaders);
      }

      if (path === "/api/diagnostics/schema") {
        return await getDatabaseSchema(env, corsHeaders);
      }

      // ============================================================================
      // DYNAMIC ORGANIZATION ROUTES - Get Organization, Get Organization Events
      // ============================================================================

      if (url.pathname.match(/^\/api\/organizations\/\d+$/)) {
        const orgId = parseInt(url.pathname.split('/').pop());
        return getOrganization(request, env, corsHeaders, orgId);
      }

      if (url.pathname.match(/^\/api\/organizations\/\d+\/events$/)) {
        const orgId = parseInt(url.pathname.split('/')[3]); // Extract ID from path
        return getOrganizationEvents(request, env, corsHeaders, orgId);
      }

      // ============================================================================
      // ORGANIZATION LISTING - Get All Organizations
      // ============================================================================

      if (path === "/api/organizations" && request.method === "GET") {
        return await getAllOrganizations(request, env, corsHeaders);
      }

      // ============================================================================
      // IMAGE SERVING - Serve Images from R2
      // ============================================================================

      if (path.startsWith("/images/")) {
        const imagePath = path.substring(8); // Remove "/images/" from the path
        console.log("Image request received for:", imagePath);
        return await serveImageFromR2(env, imagePath, corsHeaders);
      }

      // ============================================================================
      // USER MEMBERSHIP - Get Organizations Where User is a Member
      // ============================================================================

      if (path === "/api/user-member-organizations" && request.method === "GET") {
        return await getUserMemberOrganizations(request, env, corsHeaders);
      }

      // ============================================================================
      // DEFAULT - 404 Not Found
      // ============================================================================

      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: corsHeaders,
      });
    } catch (error) {
      console.error("Unhandled error:", error);
      return new Response(JSON.stringify({ error: "Server error", message: error.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  }
};

// ============================================================================
// API HANDLER FUNCTIONS - Functions for each API endpoint
// ============================================================================

/**
 * Registers a new organization.
 *
 * @param {Request} request - The incoming request containing organization data.
 * @param {object} env - The Cloudflare environment object, containing bindings.
 * @param {object} corsHeaders - CORS headers for the response.
 * @returns {Promise<Response>} - A promise that resolves with the API response.
 */
async function registerOrganization(request, env, corsHeaders) {
  try {
    // Parse form data from the multipart request
    const formData = await parseFormData(request);

    // Log what fields are coming in for debugging
    console.log("Received form data with fields:",
      [...formData.entries()].map(entry => entry[0]));

    // Get required fields
    const name = formData.get('name');
    const description = formData.get('description') || '';
    const userID = formData.get('userID');
    const privacy = formData.get('privacy') || 'public';

    // Validate required fields
    if (!name || !userID) {
      return new Response(JSON.stringify({
        success: false,
        error: `Missing required fields: ${!name ? 'name' : ''} ${!userID ? 'userID' : ''}`
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    try {
      // Check if organization name already exists
      const existingOrg = await env.D1_DB.prepare(
        'SELECT * FROM ORGANIZATION WHERE name = ?'
      ).bind(name).first();

      if (existingOrg) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Organization name already exists'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
    } catch (dbError) {
      console.error('Database check error:', dbError);
      return new Response(JSON.stringify({
        success: false,
        error: `Database check failed: ${dbError.message}`
      }), {
        status: 500,
        headers: corsHeaders
      });
    }

    // Process file uploads for thumbnail and banner if provided
    let thumbnailURL = '';
    let bannerURL = '';

    // Handle thumbnail upload
    const thumbnail = formData.get('thumbnail');
    if (thumbnail && thumbnail.size > 0) {
      console.log("Attempting to upload thumbnail:", thumbnail.name, thumbnail.size);
      // Format name to replace spaces with underscores
      const cleanName = name.replace(/\s+/g, '_');
      thumbnailURL = await uploadFileToR2(env, thumbnail, `thumbnails/Thumb_${cleanName}`);
      console.log("Thumbnail uploaded:", thumbnailURL);
    }

    // Handle banner upload
    const banner = formData.get('banner');
    if (banner && banner.size > 0) {
      console.log("Attempting to upload banner:", banner.name, banner.size);
      // Format name to replace spaces with underscores
      const cleanName = name.replace(/\s+/g, '_');
      bannerURL = await uploadFileToR2(env, banner, `banners/Banner_${cleanName}`);
      console.log("Banner uploaded:", bannerURL);
    }

    try {
      // Insert the organization
      console.log("Inserting organization:", name, description, thumbnailURL, bannerURL, privacy);
      const insertOrgStmt = env.D1_DB.prepare(`
        INSERT INTO ORGANIZATION (name, description, thumbnail, banner, privacy)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        name,
        description,
        thumbnailURL,
        bannerURL,
        privacy
      );

      const result = await insertOrgStmt.run();
      console.log("Organization inserted, result:", result);
      const newOrgID = result.meta.last_row_id;

      // Add the creator as an admin of the organization
      console.log("Adding admin relationship:", newOrgID, userID);
      await env.D1_DB.prepare(`
        INSERT INTO ORG_ADMIN (orgID, userID)
        VALUES (?, ?)
      `).bind(newOrgID, userID).run();

      return new Response(JSON.stringify({
        success: true,
        message: 'Organization created successfully',
        orgID: newOrgID
      }), {
        headers: corsHeaders
      });
    } catch (dbInsertError) {
      console.error('Database insert error:', dbInsertError);
      return new Response(JSON.stringify({
        success: false,
        error: `Database insert failed: ${dbInsertError.message}`
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
  } catch (error) {
    console.error('Error creating organization:', error);
    return new Response(JSON.stringify({
      success: false,
      error: `General error: ${error.message || 'Unknown error'}`
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * Checks if an organization name already exists in the database.
 *
 * @param {Request} request - The incoming request containing the organization name.
 * @param {object} env - The Cloudflare environment object, containing bindings.
 * @param {object} corsHeaders - CORS headers for the response.
 * @returns {Promise<Response>} - A promise that resolves with the API response.
 */
async function checkOrganizationName(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const name = url.searchParams.get('name');

    const { results } = await env.D1_DB.prepare(
      "SELECT * FROM ORGANIZATION WHERE LOWER(name) = LOWER(?)"
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

/**
 * Serves an image from Cloudflare R2 storage.
 *
 * @param {object} env - The Cloudflare environment object, containing bindings.
 * @param {string} imagePath - The path to the image within the R2 bucket.
 * @param {object} corsHeaders - CORS headers for the response.
 * @returns {Promise<Response>} - A promise that resolves with the image response.
 */
async function serveImageFromR2(env, imagePath, corsHeaders) {
  try {
    console.log("Attempting to serve image with path:", imagePath);

    let object;

    // First attempt with the path directly - no "images/" prefix needed
    // since the bucket is already named "images"
    object = await env.R2_BUCKET.get(imagePath);

    if (object === null) {
      console.error("Image not found, trying alternative path");
      // If this fails, try removing any subdirectory prefixes
      if (imagePath.includes('/')) {
        const parts = imagePath.split('/');
        const lastPart = parts[parts.length - 1];
        console.log("Trying with just filename:", lastPart);
        object = await env.R2_BUCKET.get(lastPart);
      }
    }

    if (object === null) {
      console.error("Image not found with any path:", imagePath);
      return new Response("Image not found", {
        status: 404,
        headers: corsHeaders,
      });
    }

    const contentType = getContentTypeFromPath(imagePath);
    console.log("Serving image with content type:", contentType);

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
    console.error("Error serving image:", error);
    return new Response(`Error serving image: ${error.message}`, {
      status: 500,
      headers: corsHeaders,
    });
  }
}

/**
 * Determines the content type based on the file extension.
 *
 * @param {string} path - The file path.
 * @returns {string} - The corresponding content type.
 */
function getContentTypeFromPath(path) {
  const extension = path.split('.').pop().toLowerCase();
  const contentTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'ico': 'image/x-icon'
  };
  return contentTypes[extension] || 'application/octet-stream';
}

/**
 * Handles user signup by creating a new user in the database and generating a JWT.
 *
 * @param {Request} request - The incoming request containing user data.
 * @param {object} env - The Cloudflare environment object, containing bindings.
 * @param {object} corsHeaders - CORS headers for the response.
 * @returns {Promise<Response>} - A promise that resolves with the API response.
 */
async function signup(request, env, corsHeaders) {
  try {
    console.log("Signup request received");
    const data = await request.json();
    const { f_name, l_name, email, phone, password } = data;

    // Validate required fields
    if (!f_name || !l_name || !email || !password) {
      const missingFields = [];
      if (!f_name) missingFields.push('First Name');
      if (!l_name) missingFields.push('Last Name');
      if (!email) missingFields.push('Email');
      if (!password) missingFields.push('Password');

      const errorMessage = `Missing required fields: ${missingFields.join(', ')}`;
      console.warn("Signup validation error:", errorMessage);
      return new Response(JSON.stringify({
        success: false,
        error: errorMessage
      }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    console.log("Checking for existing user");
    // Check if user already exists
    try {
      const existingUserQuery = await env.D1_DB.prepare(
        "SELECT * FROM USERS WHERE LOWER(email) = LOWER(?)"
      ).bind(email).all();

      const existingUser = existingUserQuery.results;

      if (existingUser && existingUser.length > 0) {
        return new Response(JSON.stringify({
          success: false,
          error: "A user with this email already exists"
        }), {
          status: 400,
          headers: corsHeaders,
        });
      }
    } catch (dbError) {
      console.error("Database error checking existing user:", dbError);
      return new Response(JSON.stringify({
        success: false,
        error: `Database error: ${dbError.message}`
      }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    console.log("Hashing password");
    // Hash password
    let hashedPassword;
    try {
      hashedPassword = await hashPassword(password);
    } catch (hashError) {
      console.error("Password hashing error:", hashError);
      return new Response(JSON.stringify({
        success: false,
        error: "Error processing password"
      }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    console.log("Inserting new user");
    // Insert user into database
    let newUserId;
    try {
      const insertResult = await env.D1_DB.prepare(
        "INSERT INTO USERS (f_name, l_name, email, phone, password) VALUES (?, ?, ?, ?, ?)"
      ).bind(f_name, l_name, email, phone || null, hashedPassword).run();

      newUserId = insertResult.meta.last_row_id;
      console.log("User created with ID:", newUserId);

      if (!newUserId) {
        throw new Error("Failed to get new user ID");
      }
    } catch (insertError) {
      console.error("Database insert error:", insertError);
      return new Response(JSON.stringify({
        success: false,
        error: `Failed to create user: ${insertError.message}`
      }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    console.log("Generating JWT");
    // Generate a JWT token for the user
    let token;
    try {
      token = generateJWT({ email, userId: newUserId });
    } catch (tokenError) {
      console.error("JWT generation error:", tokenError);
      return new Response(JSON.stringify({
        success: false,
        error: "Authentication error"
      }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    console.log("Signup successful");
    // Return success response
    return new Response(JSON.stringify({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: newUserId,
        userID: newUserId,
        f_name,
        l_name,
        email,
        phone: phone || null
      }
    }), {
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Signup error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: `Registration failed: ${error.message}`
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

/**
 * Handles user login by verifying credentials and generating a JWT.
 *
 * @param {Request} request - The incoming request containing login credentials.
 * @param {object} env - The Cloudflare environment object, containing bindings.
 * @param {object} corsHeaders - CORS headers for the response.
 * @returns {Promise<Response>} - A promise that resolves with the API response.
 */
async function login(request, env, corsHeaders) {
  try {
    console.log("Login request received");
    const data = await request.json();
    const { email, password } = data;

    // Log the email and password received
    console.log("Login data received:", { email, password });

    if (!email || !password) {
      return new Response(JSON.stringify({
        success: false,
        error: "Email and password are required"
      }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    console.log("Finding user");
    // Find user
    let user;
    try {
      const usersQuery = await env.D1_DB.prepare(
        "SELECT * FROM USERS WHERE LOWER(email) = LOWER(?)"
      ).bind(email).all();

      const users = usersQuery.results;

      if (!users || users.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: "Invalid email or password"
        }), {
          status: 401,
          headers: corsHeaders,
        });
      }

      user = users[0];
    } catch (dbError) {
      console.error("Database error finding user:", dbError);
      return new Response(JSON.stringify({
        success: false,
        error: `Database error: ${dbError.message}`
      }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    console.log("Verifying password");
    // Check password
    let passwordMatch;
    try {
      passwordMatch = await verifyPassword(password, user.password);
    } catch (verifyError) {
      console.error("Password verification error:", verifyError);
      return new Response(JSON.stringify({
        success: false,
        error: "Error verifying password"
      }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    if (!passwordMatch) {
      return new Response(JSON.stringify({
        success: false,
        error: "Invalid email or password"
      }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    console.log("Generating JWT token");
    // Generate a JWT token
    let token;
    try {
      token = generateJWT({ email: user.email, userId: user.userID });
    } catch (tokenError) {
      console.error("JWT generation error:", tokenError);
      return new Response(JSON.stringify({
        success: false,
        error: "Authentication error"
      }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    console.log("Login successful");
    // Return success response
    return new Response(JSON.stringify({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.userID,
        userID: user.userID,
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
    console.error("Login error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: `Login failed: ${error.message}`
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

/**
 * Checks if an email address already exists in the database.
 *
 * @param {Request} request - The incoming request containing the email address.
 * @param {object} env - The Cloudflare environment object, containing bindings.
 * @param {object} corsHeaders - CORS headers for the response.
 * @returns {Promise<Response>} - A promise that resolves with the API response.
 */
async function checkEmailExists(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');

    const { results } = await env.D1_DB.prepare(
      "SELECT * FROM USERS WHERE LOWER(email) = LOWER(?)"
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

/**
 * Retrieves a list of organizations where a user is an administrator.
 *
 * @param {Request} request - The incoming request containing the user ID.
 * @param {object} env - The Cloudflare environment object, containing bindings.
 * @param {object} corsHeaders - CORS headers for the response.
 * @returns {Promise<Response>} - A promise that resolves with the API response.
 */
async function getUserOrganizations(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const userID = url.searchParams.get('userID');

    if (!userID) {
      return new Response(JSON.stringify({
        success: false,
        error: "User ID is required"
      }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Change from ORGANIZATION_ADMIN to ORG_ADMIN
    const { results } = await env.D1_DB.prepare(`
      SELECT o.* FROM ORGANIZATION o
      JOIN ORG_ADMIN oa ON o.orgID = oa.orgID
      WHERE oa.userID = ?
    `).bind(userID).all();

    return new Response(JSON.stringify({
      success: true,
      organizations: results || []
    }), {
      headers: corsHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

/**
 * Retrieves a list of landmarks.
 *
 * @param {object} env - The Cloudflare environment object, containing bindings.
 * @param {object} corsHeaders - CORS headers for the response.
 * @returns {Promise<Response>} - A promise that resolves with the API response.
 */
async function getLandmarks(env, corsHeaders) {
  try {
    console.log("Getting landmarks");

    // For now, return an empty array since table isn't populated
    // When you add data, uncomment this:
    /*
    const result = await env.D1_DB.prepare(`
      SELECT * FROM LANDMARK
    `).all();

    return new Response(JSON.stringify({
      success: true,
      landmarks: result.results || []
    }), {
      headers: corsHeaders
    });
    */

    // Return empty array for now
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

/**
 * Checks if a landmark is available during a specified time range.
 *
 * @param {Request} request - The incoming request containing landmark ID, start date, and end date.
 * @param {object} env - The Cloudflare environment object, containing bindings.
 * @param {object} corsHeaders - CORS headers for the response.
 * @returns {Promise<Response>} - A promise that resolves with the API response.
 */
async function checkLandmarkAvailability(request, env, corsHeaders) {
  try {
    console.log("Checking landmark availability");

    // Default response for now
    return new Response(JSON.stringify({
      success: true,
      available: true
    }), {
      headers: corsHeaders
    });

    /* When you have landmarks, uncomment this:
    const { landmarkID, startDate, endDate } = await request.json();

    // Check if landmark exists
    const landmarkCheck = await env.D1_DB.prepare(`
      SELECT * FROM LANDMARK WHERE landmarkID = ?
    `).bind(landmarkID).first();

    // Rest of the function...
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

/**
 * Registers a new event.
 *
 * @param {Request} request - The incoming request containing event data.
 * @param {object} env - The Cloudflare environment object, containing bindings.
 * @param {object} corsHeaders - CORS headers for the response.
 * @returns {Promise<Response>} - A promise that resolves with the API response.
 */
async function registerEvent(request, env, corsHeaders) {
  try {
    console.log("Registering event");

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
    const isAdmin = await env.D1_DB.prepare(`
      SELECT 1 FROM ORG_ADMIN
      WHERE orgID = ? AND userID = ?
    `).bind(organizationID, userID).first();

    if (!isAdmin) {
      return new Response(JSON.stringify({
        success: false,
        error: 'User is not an admin of this organization'
      }), {
        status: 403,
        headers: corsHeaders
      });
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

    // Create the event (D1 executes each statement separately)
    const insertResult = await env.D1_DB.prepare(`
      INSERT INTO EVENT (
        organizationID, title, description, thumbnail, banner,
        startDate, endDate, privacy, officialStatus, landmarkID,
        customLocation
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    ).run();

    // Get the newly created event ID
    const newEventID = insertResult.meta.last_row_id;

    // Add the creator as an admin of the event
    await env.D1_DB.prepare(`
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

/**
 * Retrieves the database schema for diagnostic purposes.
 *
 * @param {object} env - The Cloudflare environment object, containing bindings.
 * @param {object} corsHeaders - CORS headers for the response.
 * @returns {Promise<Response>} - A promise that resolves with the API response.
 */
async function getDatabaseSchema(env, corsHeaders) {
  try {
    console.log("Getting database schema");

    // Check for views referencing old tables
    const viewsQuery = await env.D1_DB.prepare(`
      SELECT name, sql FROM sqlite_master
      WHERE type='view' AND sql LIKE '%USERS_old%'
    `).all();

    // Check for triggers referencing old tables
    const triggersQuery = await env.D1_DB.prepare(`
      SELECT name, sql FROM sqlite_master
      WHERE type='trigger' AND sql LIKE '%USERS_old%'
    `).all();

    // Check for tables with foreign keys
    const tablesWithFKQuery = await env.D1_DB.prepare(`
      SELECT name, sql FROM sqlite_master
      WHERE type='table' AND sql LIKE '%REFERENCES%USERS_old%'
    `).all();

    return new Response(JSON.stringify({
      success: true,
      views: viewsQuery.results,
      triggers: triggersQuery.results,
      tablesWithFK: tablesWithFKQuery.results
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error("Error getting database schema:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * Fixes the database schema by recreating tables with correct foreign key references.
 *
 * @param {object} env - The Cloudflare environment object, containing bindings.
 * @param {object} corsHeaders - CORS headers for the response.
 * @returns {Promise<Response>} - A promise that resolves with the API response.
 */
async function fixDatabaseSchema(env, corsHeaders) {
  try {
    console.log("Fixing database schema");

    // Get existing data from the tables first (outside of transaction)
    const orgAdmins = await env.D1_DB.prepare('SELECT * FROM ORG_ADMIN').all();
    const orgMembers = await env.D1_DB.prepare('SELECT * FROM ORG_MEMBER').all();
    const eventAdmins = await env.D1_DB.prepare('SELECT * FROM EVENT_ADMIN').all();

    // Use D1's batch method for transactions
    const statements = [];

    // Turn off foreign keys temporarily
    statements.push(env.D1_DB.prepare('PRAGMA foreign_keys=OFF'));

    // Drop the tables with incorrect foreign keys
    statements.push(env.D1_DB.prepare('DROP TABLE IF EXISTS ORG_ADMIN'));
    statements.push(env.D1_DB.prepare('DROP TABLE IF EXISTS ORG_MEMBER'));
    statements.push(env.D1_DB.prepare('DROP TABLE IF EXISTS EVENT_ADMIN'));

    // Recreate the tables with correct foreign key references
    statements.push(env.D1_DB.prepare(`
      CREATE TABLE ORG_ADMIN (
        orgID INTEGER NOT NULL,
        userID INTEGER NOT NULL,
        PRIMARY KEY (orgID, userID),
        FOREIGN KEY (orgID) REFERENCES ORGANIZATION(orgID),
        FOREIGN KEY (userID) REFERENCES USERS(userID)
      )
    `));

    statements.push(env.D1_DB.prepare(`
      CREATE TABLE ORG_MEMBER (
        orgID INTEGER NOT NULL,
        userID INTEGER NOT NULL,
        PRIMARY KEY (orgID, userID),
        FOREIGN KEY (orgID) REFERENCES ORGANIZATION(orgID),
        FOREIGN KEY (userID) REFERENCES USERS(userID)
      )
    `));

    statements.push(env.D1_DB.prepare(`
      CREATE TABLE EVENT_ADMIN (
        eventID INTEGER NOT NULL,
        userID INTEGER NOT NULL,
        PRIMARY KEY (eventID, userID),
        FOREIGN KEY (eventID) REFERENCES EVENT(eventID),
        FOREIGN KEY (userID) REFERENCES USERS(userID)
      )
    `));

    // Execute all statements in a batch (transaction)
    await env.D1_DB.batch(statements);

    // Now reinsert the data in a separate batch
    if (orgAdmins.results && orgAdmins.results.length > 0) {
      const insertStatements = orgAdmins.results.map(admin =>
        env.D1_DB.prepare('INSERT INTO ORG_ADMIN (orgID, userID) VALUES (?, ?)')
          .bind(admin.orgID, admin.userID)
      );
      if (insertStatements.length > 0) {
        await env.D1_DB.batch(insertStatements);
      }
    }

    if (orgMembers.results && orgMembers.results.length > 0) {
      const insertStatements = orgMembers.results.map(member =>
        env.D1_DB.prepare('INSERT INTO ORG_MEMBER (orgID, userID) VALUES (?, ?)')
          .bind(member.orgID, member.userID)
      );
      if (insertStatements.length > 0) {
        await env.D1_DB.batch(insertStatements);
      }
    }

    if (eventAdmins.results && eventAdmins.results.length > 0) {
      const insertStatements = eventAdmins.results.map(admin =>
        env.D1_DB.prepare('INSERT INTO EVENT_ADMIN (eventID, userID) VALUES (?, ?)')
          .bind(admin.eventID, admin.userID)
      );
      if (insertStatements.length > 0) {
        await env.D1_DB.batch(insertStatements);
      }
    }

    // Turn foreign keys back on
    await env.D1_DB.prepare('PRAGMA foreign_keys=ON').run();

    return new Response(JSON.stringify({
      success: true,
      message: 'Database schema fixed successfully'
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error('Error fixing database schema:', error);

    // Make sure foreign keys are turned back on even if an error occurs
    try {
      await env.D1_DB.prepare('PRAGMA foreign_keys=ON').run();
    } catch (e) {
      console.error('Error turning foreign keys back on:', e);
    }

    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to fix database schema'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * Retrieves a user profile based on the JWT token provided in the request headers.
 *
 * @param {Request} request - The incoming request containing the JWT token.
 * @param {object} env - The Cloudflare environment object, containing bindings.
 * @param {object} corsHeaders - CORS headers for the response.
 * @returns {Promise<Response>} - A promise that resolves with the API response.
 */
async function getUserProfile(request, env, corsHeaders) {
  try {
    console.log("User profile request received");

    // Get token from Authorization header
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Authentication token required'
      }), {
        status: 401,
        headers: corsHeaders
      });
    }

    console.log("Verifying token");
    // Verify the token
    try {
      const payload = verifyJWT(token);
      const userId = payload.userId; // Get userID from token

      if (!userId) {
        throw new Error("Invalid token: missing user ID");
      }

      console.log("Getting user profile for ID:", userId);
      // Get user data from database
      const userQuery = await env.D1_DB.prepare(`
        SELECT userID, f_name, l_name, email, phone, profile_picture
        FROM USERS WHERE userID = ?
      `).bind(userId).first();

      if (!userQuery) {
        return new Response(JSON.stringify({
          success: false,
          error: 'User not found'
        }), {
          status: 404,
          headers: corsHeaders
        });
      }

      console.log("User profile found");
      // Return user data
      return new Response(JSON.stringify({
        success: true,
        user: {
          id: userQuery.userID,
          userID: userQuery.userID,
          f_name: userQuery.f_name,
          l_name: userQuery.l_name,
          email: userQuery.email,
          phone: userQuery.phone,
          profile_picture: userQuery.profile_picture
        }
      }), {
        headers: corsHeaders
      });
    } catch (jwtError) {
      console.error("JWT verification error:", jwtError);
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid token: ${jwtError.message}`
      }), {
        status: 401,
        headers: corsHeaders
      });
    }
  } catch (error) {
    console.error("Error getting user profile:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || "Failed to get user profile"
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * Retrieves a specific organization by its ID.
 *
 * @param {Request} request - The incoming request.
 * @param {object} env - The Cloudflare environment object, containing bindings.
 * @param {object} corsHeaders - CORS headers for the response.
 * @param {number} orgId - The ID of the organization to retrieve.
 * @returns {Promise<Response>} - A promise that resolves with the API response.
 */
async function getOrganization(request, env, corsHeaders, orgId) {
  try {
    console.log("Getting organization with ID:", orgId);

    // Get the organization data
    const organization = await env.D1_DB.prepare(`
      SELECT o.*, COUNT(om.userID) as memberCount
      FROM ORGANIZATION o
      LEFT JOIN ORG_MEMBER om ON o.orgID = om.orgID
      WHERE o.orgID = ?
      GROUP BY o.orgID
    `).bind(orgId).first();

    if (!organization) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Organization not found'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }

    // Get organization admins - FIXED QUERY
    const { results: admins } = await env.D1_DB.prepare(`
      SELECT u.userID as id, u.email, u.f_name as firstName, u.l_name as lastName, u.profile_picture as profileImage
      FROM ORG_ADMIN oa
      JOIN USERS u ON oa.userID = u.userID
      WHERE oa.orgID = ?
    `).bind(orgId).all();

    // Add admins to the organization object
    organization.admins = admins || [];

    return new Response(JSON.stringify({
      success: true,
      organization
    }), {
      headers: corsHeaders
    });
  } catch (error) {
    console.error("Error getting organization:", error);
    return new Response(JSON.stringify({
      success: false,
      error: `Error fetching organization: ${error.message}`
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * Retrieves events for a specific organization.
 *
 * @param {Request} request - The incoming request.
 * @param {object} env - The Cloudflare environment object, containing bindings.
 * @param {object} corsHeaders - CORS headers for the response.
 * @param {number} orgId - The ID of the organization to retrieve events for.
 * @returns {Promise<Response>} - A promise that resolves with the API response.
 */
async function getOrganizationEvents(request, env, corsHeaders, orgId) {
  try {
    console.log("Getting events for organization with ID:", orgId);

    // Get the events for this organization
    const { results: events } = await env.D1_DB.prepare(`
      SELECT e.*
      FROM EVENT e
      WHERE e.organizationID = ?
      ORDER BY e.startDate ASC
    `).bind(orgId).all();

    return new Response(JSON.stringify({
      success: true,
      events: events || []
    }), {
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Error getting organization events:", error);
    return new Response(JSON.stringify({
      success: false,
      error: `Error fetching organization events: ${error.message}`
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

/**
 * Retrieves all organizations.
 *
 * @param {Request} request - The incoming request.
 * @param {object} env - The Cloudflare environment object, containing bindings.
 * @param {object} corsHeaders - CORS headers for the response.
 * @returns {Promise<Response>} - A promise that resolves with the API response.
 */
async function getAllOrganizations(request, env, corsHeaders) {
  try {
    console.log("Getting all organizations");

    // Get all organizations with member counts
    const { results: organizations } = await env.D1_DB.prepare(`
      SELECT o.*,
             COUNT(om.userID) as memberCount
      FROM ORGANIZATION o
      LEFT JOIN ORG_MEMBER om ON o.orgID = om.orgID
      GROUP BY o.orgID
      ORDER BY o.name ASC
    `).all();

    return new Response(JSON.stringify({
      success: true,
      organizations: organizations || []
    }), {
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Error getting all organizations:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

/**
 * Retrieves organizations where a user is a member.
 *
 * @param {Request} request - The incoming request containing the user ID.
 * @param {object} env - The Cloudflare environment object, containing bindings.
 * @param {object} corsHeaders - CORS headers for the response.
 * @returns {Promise<Response>} - A promise that resolves with the API response.
 */
async function getUserMemberOrganizations(request, env, corsHeaders) {
  try {
    console.log("Getting user member organizations");

    const url = new URL(request.url);
    const userID = url.searchParams.get('userID');

    if (!userID) {
      return new Response(JSON.stringify({
        success: false,
        error: "User ID is required"
      }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Query organizations where user is a member but not admin
    const { results } = await env.D1_DB.prepare(`
      SELECT o.* FROM ORGANIZATION o
      JOIN ORG_MEMBER om ON o.orgID = om.orgID
      WHERE om.userID = ?
    `).bind(userID).all();

    return new Response(JSON.stringify({
      success: true,
      organizations: results || []
    }), {
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Error getting user member organizations:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}