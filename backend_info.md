# The Quad Backend Documentation

This document provides comprehensive information about The Quad's backend architecture using Cloudflare Workers, D1 database, and R2 storage, and how to integrate these services with your React frontend.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Accessing Cloudflare Worker Endpoints](#accessing-cloudflare-worker-endpoints)
3. [Creating New Database Queries](#creating-new-database-queries)
4. [Working with R2 Storage](#working-with-r2-storage)
5. [Integrating with React](#integrating-with-react)
6. [Deployment](#deployment)
7. [Troubleshooting](#troubleshooting)

## Architecture Overview

The Quad uses Cloudflare Workers as its serverless backend with:
- **D1 Database**: SQL database for storing structured data
- **R2 Storage**: Object storage for images and files
- **React Frontend**: Client application that consumes API endpoints

## Accessing Cloudflare Worker Endpoints

### Base URL

- Development: `http://localhost:8787`
- Production: `https://the-quad.pages.dev`

### Available Endpoints

- `GET /api/users`: List all users
- `GET /api/users/:id`: Get user by ID
- `GET /api/organizations/public/banners`: Get organization banners
- `GET /images/:path`: Serve images from R2 storage

### Example Usage

```javascript
// Fetch users from the API
async function fetchUsers() {
    const response = await fetch('https://the-quad.pages.dev/api/users');
    const data = await response.json();
    
    if (data.success) {
        return data.data; // Array of users
    } else {
        console.error('Error fetching users:', data.error);
        return [];
    }
}
```

## Creating New Database Queries

To add new database queries to the worker:

1. Add a new route in the `fetch` function:

```javascript
if (path === "/api/events") {
    return await listEvents(env);
}
```

2. Create the corresponding handler function:

```javascript
async function listEvents(env) {
    try {
        const { results } = await env.D1_DB.prepare(
            "SELECT * FROM events WHERE date >= DATE('now') ORDER BY date LIMIT 10"
        ).all();
        
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
```

### Using Parameters

For queries with parameters:

```javascript
async function getEventById(env, id) {
    try {
        const { results } = await env.D1_DB.prepare(
            "SELECT * FROM events WHERE id = ?"
        ).bind(id).all();
        
        if (results.length === 0) {
            return new Response(JSON.stringify({ success: false, error: "Event not found" }), {
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
```

## Working with R2 Storage

### Uploading Files (For Admin Interfaces)

```javascript
async function uploadImage(env, request) {
    try {
        const formData = await request.formData();
        const file = formData.get('image');
        const filename = `${Date.now()}-${file.name}`;
        
        await env.R2_BUCKET.put(filename, file);
        
        return new Response(JSON.stringify({
            success: true,
            data: { filename, url: `/images/${filename}` }
        }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
```

### Serving Images

Images are served through the `/images/:path` endpoint:

```javascript
// Example image URL
const imageUrl = `https://the-quad.pages.dev/images/event-banner-123.jpg`;
```

## Integrating with React

### Creating a Custom Hook

```javascript
// src/hooks/useApi.js
import { useState, useEffect } from 'react';

export function useApi(endpoint) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const baseUrl = process.env.NODE_ENV === 'production' 
        ? 'https://the-quad.pages.dev'
        : 'http://localhost:8787';
        
    useEffect(() => {
        async function fetchData() {
            try {
                const response = await fetch(`${baseUrl}${endpoint}`);
                const result = await response.json();
                
                if (result.success) {
                    setData(result.data);
                } else {
                    setError(new Error(result.error));
                }
            } catch (err) {
                setError(err);
            } finally {
                setLoading(false);
            }
        }
        
        fetchData();
    }, [endpoint]);
    
    return { data, loading, error };
}
```

### Using the Hook in a Component

```javascript
// src/components/EventList.js
import React from 'react';
import { useApi } from '../hooks/useApi';
import EventCarousel from './EventCarousel';

function EventList() {
    const { data: events, loading, error } = useApi('/api/events');
    
    if (loading) return <p>Loading events...</p>;
    if (error) return <p>Error loading events: {error.message}</p>;
    
    return <EventCarousel events={events} />;
}

export default EventList;
```

## Deployment

To deploy your worker:

```bash
# Development mode
npm run dev

# Production deployment
npm run deploy
```

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure your worker has appropriate CORS headers:

```javascript
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
};

// Add to your response
return new Response(JSON.stringify(data), {
    headers: { 
        "Content-Type": "application/json",
        ...corsHeaders
    }
});
```

2. **Missing Database Tables**: Check if your D1 database is properly initialized with required tables.

3. **R2 Access Issues**: Verify your R2 bucket name in `wrangler.toml` matches your actual bucket.

---