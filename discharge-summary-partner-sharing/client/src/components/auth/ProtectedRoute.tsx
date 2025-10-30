import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getCurrentUser } from 'aws-amplify/auth';
import '../../config/amplify';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  
  useEffect(() => {
    const checkAuth = () => {
      // Check localStorage first for immediate response
      const localAuth = localStorage.getItem('isAuthenticated');
      console.log('ProtectedRoute: Checking auth, localStorage:', localAuth);
      
      if (localAuth === 'true') {
        console.log('ProtectedRoute: User is authenticated via localStorage');
        setIsAuthenticated(true);
      } else {
        console.log('ProtectedRoute: User is not authenticated');
        setIsAuthenticated(false);
      }
    };
    
    checkAuth();
  }, []);
  
  console.log('ProtectedRoute: Current auth state:', isAuthenticated);
  
  if (isAuthenticated === null) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>;
  }
  
  if (!isAuthenticated) {
    console.log('ProtectedRoute: Redirecting to login');
    return <Navigate to="/login" replace />;
  }
  
  console.log('ProtectedRoute: Rendering protected content');
  return <>{children}</>;
};

export default ProtectedRoute;