import React from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'aws-amplify/auth';
import { useToast } from '../../hooks/useToast';
import { ToastType } from '../../enums/ToastType';
import '../../config/amplify';

const LogoutButton: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleLogout = async () => {
    try {
      await signOut();
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('userEmail');
      showToast(ToastType.SUCCESS, 'Logged out successfully');
      navigate('/welcome');
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if Cognito fails
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('userEmail');
      navigate('/welcome');
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="text-red-600 hover:text-red-700 font-medium px-4 py-2 rounded-lg hover:bg-red-50 transition-colors duration-200"
    >
      Logout
    </button>
  );
};

export default LogoutButton;