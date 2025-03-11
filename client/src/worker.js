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
    const formData = await request.formData();
    const name = formData.get('name');
    const description = formData.get('description');
    const thumbnailFile = formData.get('thumbnail');
    const bannerFile = formData.get('banner');
    const privacy = formData.get('privacy');
    const submitForOfficialStatus = formData.get('submitForOfficialStatus') === 'true';

    // Validate name uniqueness (case-insensitive)
    const { results: existingOrg } = await env.D1_DB.prepare(
      "SELECT * FROM organization WHERE LOWER(name) = LOWER(?)"
    ).bind(name).all();
    
    if (existingOrg && existingOrg.length > 0) {
      return new Response(JSON.stringify({ success: false, error: "Organization name already exists" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    let thumbnailPath = null;
    let bannerPath = null;

    // Create sanitized organization name for file paths (remove special chars, replace spaces with underscores)
    const sanitizedOrgName = name.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');

    if (thumbnailFile) {
      // Store in Thumbnails folder with organization name
      const fileExtension = thumbnailFile.name.split('.').pop().toLowerCase();
      thumbnailPath = `thumbnails/${sanitizedOrgName}.${fileExtension}`;
      
      // Upload to R2 (this will overwrite if a file already exists at this path)
      await env.R2_BUCKET.put(thumbnailPath, thumbnailFile);
    }

    if (bannerFile) {
      // Store in Banners folder with organization name
      const fileExtension = bannerFile.name.split('.').pop().toLowerCase();
      bannerPath = `banners/${sanitizedOrgName}.${fileExtension}`;
      
      // Upload to R2 (this will overwrite if a file already exists at this path)
      await env.R2_BUCKET.put(bannerPath, bannerFile);
    }

    // Insert organization data into D1
    await env.D1_DB.prepare(
      "INSERT INTO organization (name, description, thumbnail, banner, privacy) VALUES (?, ?, ?, ?, ?)"
    ).bind(
      name,
      description,
      thumbnailPath ? `/images/${thumbnailPath}` : null,
      bannerPath ? `/images/${bannerPath}` : null,
      privacy
    ).run();

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Organization registered successfully",
      thumbnailPath: thumbnailPath ? `/images/${thumbnailPath}` : null,
      bannerPath: bannerPath ? `/images/${bannerPath}` : null
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