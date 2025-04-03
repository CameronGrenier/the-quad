import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * A wrapper component that redirects to login if the user is not authenticated
 * @param {Object} props - Component props 
 * @param {React.ReactNode} props.children - Child components to render if authenticated
 */
function PrivateRoute({ children }) {
  const { currentUser, loading } = useAuth();

  // Show loading state while auth state is being determined
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }
  
  // Redirect to login if not authenticated
  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  // Render child components if authenticated
  return children;
}

export default PrivateRoute;