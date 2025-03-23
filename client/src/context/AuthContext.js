import React, { createContext, useState, useContext, useEffect } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'https://the-quad-worker.gren9484.workers.dev';
const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for stored credentials on component mount
  useEffect(() => {
    console.log("AuthContext initializing...");
    const checkExistingSession = async () => {
      try {
        const token = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');
        
        if (token && savedUser) {
          try {
            // Parse saved user data
            const parsedUser = JSON.parse(savedUser);
            console.log("Found stored user data:", {
              email: parsedUser.email,
              id: parsedUser.id || parsedUser.userID || '(missing)',
              hasID: !!parsedUser.id || !!parsedUser.userID
            });
            
            // Standardize the user object to have both ID formats
            const standardizedUser = {
              ...parsedUser,
              id: parsedUser.id || parsedUser.userID,
              userID: parsedUser.userID || parsedUser.id
            };
            
            // If we have a token but missing user ID, fetch fresh user data
            if (!parsedUser.id) {
              console.log("User ID missing, fetching fresh user data");
              // Attempt to refresh user data
              await refreshUserData(token);
            } else {
              // Use the stored user data
              setCurrentUser(standardizedUser);
            }
          } catch (err) {
            console.error("Error parsing saved user:", err);
            // Clear invalid data
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
        }
      } finally {
        setLoading(false);
      }
    };
    
    checkExistingSession();
  }, []);

  // Function to refresh user data from the server
  const refreshUserData = async (token) => {
    try {
      const response = await fetch(`${API_URL}/api/user-profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        if (userData.success && userData.user) {
          // Save the complete user data
          const user = {
            id: userData.user.userID || userData.user.id,
            userID: userData.user.userID || userData.user.id, // Store ID in both formats for safety
            email: userData.user.email,
            f_name: userData.user.f_name,
            l_name: userData.user.l_name,
            // Add any other fields from the response
          };
          
          localStorage.setItem('user', JSON.stringify(user));
          setCurrentUser(user);
          return true;
        }
      }
      
      // If we couldn't refresh, clear the invalid session
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setCurrentUser(null);
      return false;
    } catch (error) {
      console.error("Error refreshing user data:", error);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setCurrentUser(null);
      return false;
    }
  };

  const login = async (email, password) => {
    try {
      setLoading(true);
      
      // Log the email and password being sent
      console.log("Sending login request with:", { email, password });
      
      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success && data.token && data.user) {
        // Make sure we standardize the user object structure
        const user = {
          id: data.user.userID || data.user.id, // Handle both formats
          userID: data.user.userID || data.user.id, // Store ID in both formats for safety
          email: data.user.email,
          f_name: data.user.f_name,
          l_name: data.user.l_name,
          // Include any other user properties
        };
        
        console.log("Login successful, user data:", {
          email: user.email,
          id: user.id,
          userID: user.userID
        });
        
        // Make sure we have an ID before storing
        if (!user.id) {
          console.error("API returned user without ID");
          return { success: false, error: "Invalid user data returned from server" };
        }
        
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(user));
        setCurrentUser(user);
        return { success: true };
      } else {
        console.error("Login API error:", data.error);
        return { success: false, error: data.error || "Login failed" };
      }
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Update the signup function with better error handling
  const signup = async (userData) => {
    try {
      setLoading(true);
      
      // Ensure the data has the correct field names
      const signupData = {
        f_name: userData.f_name || userData.firstName || "",
        l_name: userData.l_name || userData.lastName || "",
        username: userData.username,
        email: userData.email || "",
        phone: userData.phone || "",
        password: userData.password || ""
      };
      
      console.log("Submitting signup data:", {
        ...signupData,
        password: signupData.password ? "password provided" : "no password"
      });
      
      // Check for missing required fields
      if (!signupData.f_name || !signupData.l_name || !signupData.email || !signupData.password) {
        const missingFields = [];
        if (!signupData.f_name) missingFields.push('First Name');
        if (!signupData.l_name) missingFields.push('Last Name');
        if (!signupData.email) missingFields.push('Email');
        if (!signupData.password) missingFields.push('Password');
        
        const errorMessage = `Missing required fields: ${missingFields.join(', ')}`;
        console.error("Signup validation error:", errorMessage);
        return { success: false, error: errorMessage };
      }
      
      const response = await fetch(`${API_URL}/api/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(signupData),
      });

      // Log the full response for debugging
      console.log("Signup response status:", response.status);
      
      const data = await response.json();
      console.log("Signup response data:", data);

      if (data.success && data.token && data.user) {
        // Standardize user object structure
        const user = {
          id: data.user.userID || data.user.id,
          userID: data.user.userID || data.user.id, 
          email: data.user.email,
          f_name: data.user.f_name,
          l_name: data.user.l_name,
          // Other properties...
        };
        
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(user));
        setCurrentUser(user);
        return { success: true };
      } else {
        console.error("Signup API error:", data.error);
        return { success: false, error: data.error || "Signup failed" };
      }
    } catch (error) {
      console.error("Signup error:", error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentUser(null);
  };

  // Add updateCurrentUser function to update the user data in context
  const updateCurrentUser = (userData) => {
    setCurrentUser(userData);
    // Also update localStorage to persist the changes
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const value = {
    currentUser,
    loading,
    login,
    signup,
    logout,
    refreshUserData,
    updateCurrentUser
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}