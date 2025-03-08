export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Basic routing
    if (path === "/api/users") {
      return await listUsers(env);
    } else if (path.startsWith("/api/users/")) {
      const id = path.split("/").pop();
      return await getUserById(env, id);
    } else if (path === "/api/organizations/public/banners") {
      // Pass request to get the host
      return await getPublicOrganizationBanners(env, request);
    } else if (path.startsWith("/images/")) {
      // New route to serve images from R2
      const imagePath = path.replace("/images/", "");
      return await serveImageFromR2(env, imagePath);
    } else {
      return new Response("Not found", { status: 404 });
    }
  }
};

// Example: Get all users from a table
async function listUsers(env) {
  try {
    // Execute the query
    const { results } = await env.D1_DB.prepare(
      "SELECT * FROM users LIMIT 100"
    ).all();
    
    // Return the results as JSON
    return new Response(JSON.stringify({ success: true, data: results }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// Example: Get a user by ID
async function getUserById(env, id) {
  try {
    // Execute a parameterized query
    const { results } = await env.D1_DB.prepare(
      "SELECT * FROM users WHERE id = ?"
    ).bind(id).all();
    
    if (results.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    return new Response(JSON.stringify({ success: true, data: results[0] }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// Function to get public organization banners
async function getPublicOrganizationBanners(env, request) {
  try {
    // Query for organizations with "public" privacy
    const { results } = await env.D1_DB.prepare(
      "SELECT orgID, name, banner FROM organization WHERE privacy = ?"
    ).bind("public").all();
    
    // Transform the results to use worker URLs instead of R2 URLs
    const transformedResults = results.map(org => {
      // Extract the image path from the R2 URL
      const bannerUrl = org.banner;
      // Extract just the filename part after the last slash
      const imagePath = bannerUrl.split('/').pop();
      
      // Return modified organization with worker URL
      return {
        ...org,
        banner: `https://${request.headers.get("host")}/images/banners/${imagePath}`,
        original_url: bannerUrl // keep the original URL for reference
      };
    });
    
    // Return the transformed results as JSON
    return new Response(JSON.stringify({ 
      success: true, 
      data: transformedResults 
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// Function to serve images from R2
async function serveImageFromR2(env, imagePath) {
  try {
    // Get image from R2 bucket
    const object = await env.R2_BUCKET.get(imagePath);
    
    if (object === null) {
      return new Response("Image not found", { status: 404 });
    }
    
    // Determine content type based on file extension
    const contentType = getContentTypeFromPath(imagePath);
    
    // Return the image with proper headers
    return new Response(object.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      }
    });
  } catch (error) {
    return new Response(`Error serving image: ${error.message}`, {
      status: 500
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