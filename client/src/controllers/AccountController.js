/**
 * Account Controller for The Quad
 * 
 * Handles user account operations like signup, login, profile management
 */

import formDataUtil from '../utils/formData.js';

class AccountController {
  constructor(env, corsHeaders, backendService, auth) {
    this.env = env;
    this.corsHeaders = corsHeaders;
    this.backendService = backendService;
    this.auth = auth;
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
      
      const existingUsername = await this.backendService.queryFirst(
        "SELECT * FROM USERS WHERE LOWER(username)=LOWER(?)", 
        [username]
      );
      if (existingUsername) {
        return new Response(JSON.stringify({
          success: false,
          error: "A user with this username already exists"
        }), { status: 400, headers: this.corsHeaders });
      }
      
      const existingUser = await this.backendService.queryFirst(
        "SELECT * FROM USERS WHERE LOWER(email)=LOWER(?)", 
        [email]
      );
      if (existingUser) {
        return new Response(JSON.stringify({
          success: false,
          error: "A user with this email already exists"
        }), { status: 400, headers: this.corsHeaders });
      }
      
      const hashed = await this.auth.hashPassword(password);
      const insertResult = await this.backendService.query(
        "INSERT INTO USERS (username, f_name, l_name, email, phone, password) VALUES (?,?,?,?,?,?)",
        [username, f_name, l_name, email, phone || null, hashed]
      );
      const userID = insertResult.meta.last_row_id;
      
      const token = this.auth.generateJWT({ email, userId: userID, username });
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
      
      const usersQuery = await this.backendService.queryAll(
        "SELECT * FROM USERS WHERE LOWER(email)=LOWER(?)",
        [email]
      );
      
      const users = usersQuery.results;
      if (!users || users.length === 0) {
        return new Response(JSON.stringify({ success: false, error: "Invalid email or password" }),
          { status: 401, headers: this.corsHeaders });
      }
      
      const user = users[0];
      const passOk = await this.auth.verifyPassword(password, user.password);
      if (!passOk) {
        return new Response(JSON.stringify({ success: false, error: "Invalid email or password" }),
          { status: 401, headers: this.corsHeaders });
      }
      
      const token = this.auth.generateJWT({ email: user.email, userId: user.userID, username: user.username });
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
      
      const payload = this.auth.verifyJWT(token);
      const userId = payload.userId;
      if (!userId) throw new Error("Invalid token: missing user ID");
      
      const userQuery = await this.backendService.queryFirst(
        "SELECT userID, f_name, l_name, email, phone, profile_picture FROM USERS WHERE userID = ?",
        [userId]
      );
      
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
  
  async updateProfile(request) {
    try {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '');
      if (!token) {
        return new Response(JSON.stringify({ success: false, error: "Authentication token required" }),
          { status: 401, headers: this.corsHeaders });
      }
      
      const payload = this.auth.verifyJWT(token);
      const userId = payload.userId;
      if (!userId) throw new Error("Invalid token: missing user ID");
      
      const formData = await formDataUtil.parseFormData(request);
      const f_name = formData.get('f_name');
      const l_name = formData.get('l_name');
      const email = formData.get('email');
      const phone = formData.get('phone') || null;
      
      if (!f_name || !l_name || !email) {
        return new Response(JSON.stringify({
          success: false,
          error: "First name, last name and email are required"
        }), { status: 400, headers: this.corsHeaders });
      }
      
      const existingUser = await this.backendService.queryFirst(
        "SELECT * FROM USERS WHERE LOWER(email)=LOWER(?) AND userID != ?",
        [email, userId]
      );
      
      if (existingUser) {
        return new Response(JSON.stringify({
          success: false,
          error: "This email address is already in use by another account"
        }), { status: 400, headers: this.corsHeaders });
      }
      
      let profilePictureUrl = null;
      const profilePicture = formData.get('profile_picture');
      
      if (profilePicture && profilePicture.size > 0) {
        profilePictureUrl = await this.backendService.uploadFile(
          profilePicture, 
          `profile_pictures/user_${userId}_${Date.now()}`
        );
      }
      
      let updateQuery = `
        UPDATE USERS 
        SET f_name = ?, l_name = ?, email = ?, phone = ?
      `;
      
      let params = [f_name, l_name, email, phone];
      
      if (profilePicture && profilePicture.size > 0) {
        updateQuery += `, profile_picture = ?`;
        params.push(profilePictureUrl);
      }
      
      updateQuery += ` WHERE userID = ?`;
      params.push(userId);
      
      await this.backendService.query(updateQuery, params);
      
      const updatedUser = await this.backendService.queryFirst(
        "SELECT userID, f_name, l_name, email, phone, profile_picture FROM USERS WHERE userID = ?",
        [userId]
      );
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Profile updated successfully",
        user: updatedUser
      }), { headers: this.corsHeaders });
    } catch (error) {
      console.error("Error in updateProfile:", error);
      return new Response(JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: this.corsHeaders });
    }
  }
}

export default AccountController;