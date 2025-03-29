import React, { createContext, useState, useContext, useEffect } from 'react';

// Create the AuthContext
const AuthContext = createContext();

// Hook for child components to get the auth context
export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // API URL for authentication requests
  const API_URL = 'https://the-quad-worker.gren9484.workers.dev';

  // Define refreshUserData function BEFORE using it in useEffect
  // Function to refresh user data with token
  const refreshUserData = async (token) => {
    try {
      const response = await fetch(`${API_URL}/api/user-profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (data.success && data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
        setCurrentUser(data.user);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to refresh user data:", error);
      return false;
    }
  };

  useEffect(() => {
    console.log("AuthContext initializing...");
    // Check for existing session when component mounts
    const checkExistingSession = async () => {
      try {
        const token = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');
        
        // Debug the stored data
        console.log("Checking existing session:", { 
          hasToken: !!token,
          hasSavedUser: !!savedUser
        });
        
        if (token) {
          try {
            // Always try to get fresh user data if we have a token
            const refreshed = await refreshUserData(token);
            
            if (!refreshed) {
              // If refresh failed but we have saved user data, try to use it
              if (savedUser && savedUser !== "undefined") {
                try {
                  const parsedUser = JSON.parse(savedUser);
                  console.log("Using stored user data:", parsedUser);
                  setCurrentUser(parsedUser);
                } catch (parseError) {
                  console.error("Failed to parse saved user:", parseError);
                  localStorage.removeItem('user');
                }
              } else {
                // If refresh failed and no valid stored data, clear everything
                console.log("No valid user data found, logging out");
                localStorage.removeItem('token');
                localStorage.removeItem('user');
              }
            }
          } catch (err) {
            console.error("Error checking session:", err);
            // Clear invalid data on error
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

  // Login function - returns success/result
  const login = async (email, password) => {
    try {
      setLoading(true);
      
      console.log("Sending login request with:", { email, password });
      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      console.log("Login response data:", data);
      
      if (data.success && data.token) {
        localStorage.setItem('token', data.token);
        
        if (data.user) {
          console.log("Saving user data to localStorage:", data.user);
          localStorage.setItem('user', JSON.stringify(data.user));
          setCurrentUser(data.user);
          return { success: true };
        } else {
          return { success: false, error: "No user data in response" };
        }
      } else {
        return { success: false, error: data.error || "Login failed" };
      }
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentUser(null);
  };

  // Add this function to your AuthProvider
  const updateCurrentUser = (userData) => {
    setCurrentUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  // Update the value object to include refreshUserData and updateCurrentUser
  const value = {
    currentUser,
    login,
    logout,
    loading,
    refreshUserData,
    updateCurrentUser  // Add this line
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};