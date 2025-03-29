//Imports
import { parseRequest, handleRequest } from '../services/BackendService.js';
import { verifyPassword, generateJWT, verifyJWT, hashPassword } from '../utils/auth.js';
import * as DatabaseService from '../services/DatabaseService.js';

/**
 * AccountController class handles user account-related endpoints
 */
export class AccountController {
  constructor(env, corsHeaders = {}) {
    console.log("AccountController constructor, env keys:", Object.keys(env));
    console.log("D1_DB exists in constructor:", env.D1_DB !== undefined);
    this.env = env;
    this.corsHeaders = corsHeaders;
  }

  /**
   * Creates a new user account
   * @param {Request} request - The incoming request object
   * @returns {Promise<Response>} - The response object
   */
  async createAccount(request) {
    return handleRequest(request, async (req) => {
      const data = await parseRequest(req);
      const { f_name, l_name, username, email, phone, password } = data;
      if (!f_name || !l_name || !username || !email || !password) {
        throw new Error("Missing required fields");
      }

      const existingUsername = await DatabaseService.query(this.env, "SELECT * FROM USERS WHERE LOWER(username)=LOWER(?)", [username]);
      if (existingUsername.length > 0) {
        throw new Error("A user with this username already exists");
      }

      const existingUser = await DatabaseService.query(this.env, "SELECT * FROM USERS WHERE LOWER(email)=LOWER(?)", [email]);
      if (existingUser.length > 0) {
        throw new Error("A user with this email already exists");
      }

      const hashed = await hashPassword(password);
      const insertResult = await DatabaseService.execute(this.env, "INSERT INTO USERS (username, f_name, l_name, email, phone, password) VALUES (?,?,?,?,?,?)", [username, f_name, l_name, email, phone || null, hashed]);
      const userID = insertResult.meta.last_row_id;
      const token = await generateJWT({ email, userId: userID, username }, this.env.JWT_SECRET);

      return {
        message: "User registered successfully",
        token,
        user: { id: userID, userID, username, f_name, l_name, email, phone: phone || null },
      };
    });
  }

  /**
   * Logs in a user
   * @param {Request} request - The incoming request object
   * @returns {Promise<Response>} - The response object
   */
  async login(request) {
    try {
      console.log("Login method called");
      // Parse the request body for email and password.
      const data = await parseRequest(request);
      console.log("Request parsed:", data);
      const { email, password } = data;
      if (!email || !password) {
        throw new Error("Email and password are required");
      }
      
      console.log("About to query database with env:", Object.keys(this.env));
      // Query the users from the database.
      const users = await DatabaseService.query(
        this.env,
        "SELECT * FROM USERS WHERE LOWER(email)=LOWER(?)",
        [email]
      );
      console.log("Query results:", users);
      if (users.length === 0) {
        throw new Error("Invalid email or password");
      }
      const user = users[0];
      
      // Verify the password.
      const passOk = await verifyPassword(password, user.password);
      if (!passOk) {
        throw new Error("Invalid email or password");
      }
      
      // Generate JWT token.
      const jwtSecret = this.env.JWT_SECRET || "4ce3238e21b48e1c8b056561365ff037dbdcf0664587d3408a7196d772e29475";
      const token = await generateJWT(
        { email: user.email, userId: user.userID, username: user.username },
        jwtSecret
      );
      
      // Build and return the login payload as a Response object.
      const loginPayload = {
        message: "Login successful",
        token,
        user: {
          id: user.userID,
          userID: user.userID,
          username: user.username,
          f_name: user.f_name,
          l_name: user.l_name,
          email: user.email,
          phone: user.phone,
          profile_picture: user.profile_picture,
        },
      };
      console.log("Returning login payload:", loginPayload);
      
      // Return the Response directly
      return new Response(JSON.stringify({
        success: true,
        ...loginPayload
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
      });
    } catch (error) {
      console.error("Login error:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { 
          status: 500, 
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          }
        }
      );
    }
  }

  /**
   * Gets the user profile
   * @param {Request} request - The incoming request object
   * @returns {Promise<Response>} - The response object
   */
  async getUserProfile(request) {
    try {
      // Get the user ID from the JWT token
      const token = request.headers.get('Authorization')?.split(' ')[1];
      if (!token) {
        return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      
      // Verify token and get user data
      const jwtSecret = this.env.JWT_SECRET || "4ce3238e21b48e1c8b056561365ff037dbdcf0664587d3408a7196d772e29475";
      const payload = await verifyJWT(token, jwtSecret);
      
      console.log("Decoded JWT payload:", payload); // Add this debug line
      
      // Query the user from the database - notice we need to check both userId and userID
      const userId = payload.userId || payload.userID;
      if (!userId) {
        console.error("No userId found in token payload:", payload);
        return new Response(JSON.stringify({ success: false, error: 'Invalid token: no user ID' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      
      console.log("Querying user with ID:", userId);
      
      const users = await DatabaseService.query(
        this.env,
        "SELECT userID, username, f_name, l_name, email, phone, profile_picture, created_at, updated_at FROM USERS WHERE userID = ?",
        [userId]
      );
      
      console.log("Database query result:", users);
      
      if (users.length === 0) {
        return new Response(JSON.stringify({ success: false, error: 'User not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      
      const user = users[0];
      
      // Return the user profile
      return new Response(JSON.stringify({
        success: true,
        user: {
          userID: user.userID,
          id: user.userID, // Add this for compatibility
          username: user.username,
          f_name: user.f_name,
          l_name: user.l_name,
          email: user.email,
          phone: user.phone,
          profile_picture: user.profile_picture,
          created_at: user.created_at,
          updated_at: user.updated_at
        }
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    } catch (error) {
      console.error("Error getting user profile:", error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }
  }
}