//Imports
import * as BackendService from '../services/BackendService.js';
import * as DatabaseService from '../services/DatabaseService.js';


/**
 * AccountController class handles user account-related endpoints
 */
export class AccountController {
  constructor(env) {
    this.env = env;
  }

  /**
   * Creates a new user account
   * @param {Request} request - The incoming request object
   * @returns {Promise<Response>} - The response object
   */
  async createAccount(request) {
    return BackendService.handleRequest(request, async (req) => {
      const data = await BackendService.parseRequest(req);
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

      const hashed = await Utils.hashPassword(password);
      const insertResult = await DatabaseService.execute(this.env, "INSERT INTO USERS (username, f_name, l_name, email, phone, password) VALUES (?,?,?,?,?,?)", [username, f_name, l_name, email, phone || null, hashed]);
      const userID = insertResult.meta.last_row_id;
      const token = Utils.generateJWT({ email, userId: userID, username });

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
    return BackendService.handleRequest(request, async (req) => {
      const data = await BackendService.parseRequest(req);
      const { email, password } = data;
      if (!email || !password) {
        throw new Error("Email and password are required");
      }

      const users = await DatabaseService.query(this.env, "SELECT * FROM USERS WHERE LOWER(email)=LOWER(?)", [email]);
      if (users.length === 0) {
        throw new Error("Invalid email or password");
      }

      const user = users[0];
      const passOk = await Utils.verifyPassword(password, user.password);
      if (!passOk) {
        throw new Error("Invalid email or password");
      }

      const token = Utils.generateJWT({ email: user.email, userId: user.userID, username: user.username });
      return {
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
    });
  }

  /**
   * Gets the user profile
   * @param {Request} request - The incoming request object
   * @returns {Promise<Response>} - The response object
   */
  async getUserProfile(request) {
    return BackendService.handleRequest(request, async (req) => {
      const authHeader = req.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "");
      if (!token) {
        throw new Error("Authentication token required");
      }

      const payload = Utils.verifyJWT(token);
      const userId = payload.userId;
      if (!userId) throw new Error("Invalid token: missing user ID");

      const userQuery = await DatabaseService.query(this.env, "SELECT userID, f_name, l_name, email, phone, profile_picture FROM USERS WHERE userID = ?", [userId]);
      if (userQuery.length === 0) {
        throw new Error("User not found");
      }

      return { user: userQuery[0] };
    });
  }
}