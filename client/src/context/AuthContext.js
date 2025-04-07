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
        // Try localStorage first
        let token = null;
        let savedUser = null;
        
        try {
          token = localStorage.getItem('token');
          savedUser = localStorage.getItem('user');
        } catch (e) {
          // Fall back to memory storage
          token = window._authToken;
          savedUser = window._authUser ? JSON.stringify(window._authUser) : null;
        }
        
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
  const refreshUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const response = await fetch(`${API_URL}/api/user-profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      
      if (data.success) {
        localStorage.setItem('user', JSON.stringify(data.user));
        setCurrentUser(data.user);
      }
    } catch (error) {
      console.error("Failed to refresh user data:", error);
    }
  };

  const login = async (email, password) => {
    try {
      setLoading(true);
      
      // 1. Check if localStorage is available
      const isStorageAvailable = checkStorageAvailability();
      
      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json' // Add explicit Accept header for Safari
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include' // Add this to handle cookies properly
      });
      
      console.log("Login response status:", response.status);
      const data = await response.json();
      console.log("Login response:", data);
      
      if (data.success && data.token) {
        // Try to store the token, with fallback handling
        try {
          localStorage.setItem('token', data.token);
        } catch (storageError) {
          console.warn("LocalStorage unavailable, using memory storage:", storageError);
          window._authToken = data.token; // Fallback to memory storage
        }
        
        // Fetch user profile with more robust error handling
        try {
          const userResponse = await fetch(`${API_URL}/api/user-profile`, {
            headers: { 
              'Authorization': `Bearer ${data.token}`,
              'Accept': 'application/json'
            },
            credentials: 'include'
          });
          
          const userData = await userResponse.json();
          
          if (userData.success) {
            try {
              localStorage.setItem('user', JSON.stringify(userData.user));
            } catch (e) {
              window._authUser = userData.user; // Fallback
            }
            setCurrentUser(userData.user);
          } else {
            setUserDataFromLoginResponse(data);
          }
        } catch (profileError) {
          console.warn("Failed to fetch profile, using login data:", profileError);
          setUserDataFromLoginResponse(data);
        }
        
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: `Login error: ${error.message}` };
    } finally {
      setLoading(false);
    }
  };

  // Helper function to set user data from login response
  const setUserDataFromLoginResponse = (data) => {
    try {
      localStorage.setItem('user', JSON.stringify(data.user));
    } catch (e) {
      window._authUser = data.user;
    }
    setCurrentUser(data.user);
  };

  // Helper function to check if storage is available
  const checkStorageAvailability = () => {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
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