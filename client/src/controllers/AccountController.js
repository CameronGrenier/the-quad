import { generateJWT, hashPassword, verifyPassword, verifyJWT } from '../utils/auth.js';

export class AccountController {
  constructor(env, corsHeaders) {
    this.env = env;
    this.corsHeaders = corsHeaders;
  }

  async createAccount(request) {
    try {
      const data = await request.json();
      const { f_name, l_name, username, email, phone, password } = data;
      if (!f_name || !l_name || !username || !email || !password) {
        const missing = [];
        if (!f_name) missing.push('First Name');
        if (!l_name) missing.push('Last Name');
        if (!username) missing.push('Username');
        if (!email) missing.push('Email');
        if (!password) missing.push('Password');
        return new Response(JSON.stringify({
          success: false,
          error: `Missing required fields: ${missing.join(', ')}`
        }), { status: 400, headers: this.corsHeaders });
      }
      
      // Check if username already exists
      const existingUsername = await this.env.D1_DB.prepare(
        "SELECT * FROM USERS WHERE LOWER(username)=LOWER(?)"
      ).bind(username).first();
      if (existingUsername) {
        return new Response(JSON.stringify({
          success: false,
          error: "A user with this username already exists"
        }), { status: 400, headers: this.corsHeaders });
      }
      
      // Check if email already exists
      const existingUser = await this.env.D1_DB.prepare(
        "SELECT * FROM USERS WHERE LOWER(email)=LOWER(?)"
      ).bind(email).first();
      if (existingUser) {
        return new Response(JSON.stringify({
          success: false,
          error: "A user with this email already exists"
        }), { status: 400, headers: this.corsHeaders });
      }
      
      const hashed = await hashPassword(password);
      const insertResult = await this.env.D1_DB.prepare(
        "INSERT INTO USERS (username, f_name, l_name, email, phone, password) VALUES (?,?,?,?,?,?)"
      ).bind(username, f_name, l_name, email, phone || null, hashed).run();
      const userID = insertResult.meta.last_row_id;
      const token = generateJWT({ email, userId: userID, username });
      return new Response(JSON.stringify({
        success: true,
        message: "User registered successfully",
        token,
        user: { id: userID, userID, username, f_name, l_name, email, phone: phone || null }
      }), { headers: this.corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: this.corsHeaders });
    }
  }

  async login(request) {
    try {
      const data = await request.json();
      const { email, password } = data;
      if (!email || !password) {
        return new Response(JSON.stringify({
          success: false,
          error: "Email and password are required"
        }), { status: 400, headers: this.corsHeaders });
      }
      const usersQuery = await this.env.D1_DB.prepare(
        "SELECT * FROM USERS WHERE LOWER(email)=LOWER(?)"
      ).bind(email).all();
      const users = usersQuery.results;
      if (!users || users.length === 0) {
        return new Response(JSON.stringify({ success: false, error: "Invalid email or password" }),
          { status: 401, headers: this.corsHeaders });
      }
      const user = users[0];
      const passOk = await verifyPassword(password, user.password);
      if (!passOk) {
        return new Response(JSON.stringify({ success: false, error: "Invalid email or password" }),
          { status: 401, headers: this.corsHeaders });
      }
      const token = generateJWT({ email: user.email, userId: user.userID, username: user.username });
      return new Response(JSON.stringify({
        success: true,
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
          profile_picture: user.profile_picture
        }
      }), { headers: this.corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: this.corsHeaders });
    }
  }

  async getUserProfile(request) {
    try {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '');
      if (!token) {
        return new Response(JSON.stringify({ success: false, error: "Authentication token required" }),
          { status: 401, headers: this.corsHeaders });
      }
      const payload = verifyJWT(token);
      const userId = payload.userId;
      if (!userId) throw new Error("Invalid token: missing user ID");
      const userQuery = await this.env.D1_DB.prepare(
        "SELECT userID, f_name, l_name, email, phone, profile_picture FROM USERS WHERE userID = ?"
      ).bind(userId).first();
      if (!userQuery) {
        return new Response(JSON.stringify({ success: false, error: "User not found" }),
          { status: 404, headers: this.corsHeaders });
      }
      return new Response(JSON.stringify({ success: true, user: userQuery }),
        { headers: this.corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: this.corsHeaders });
    }
  }
}