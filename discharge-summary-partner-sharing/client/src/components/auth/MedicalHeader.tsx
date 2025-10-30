import React from 'react';
import { Link } from 'react-router-dom';

interface MedicalHeaderProps {
  showAuthButtons?: boolean;
}

const MedicalHeader: React.FC<MedicalHeaderProps> = ({ showAuthButtons = true }) => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-20">
          <div className="flex items-center space-x-6 md:space-x-8 flex-1">
            <Link to="/welcome" className="flex items-center space-x-4 md:space-x-6">
              <div className="flex items-center">
                <div className="relative">
                  <svg className="h-8 md:h-10 w-auto" viewBox="0 0 280 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15 30 Q140 8 265 30" stroke="#DC2626" strokeWidth="4" fill="none"/>
                    <text x="15" y="45" fill="#1F2937" fontSize="20" fontWeight="bold" fontFamily="Arial, sans-serif">
                      FRONTIER
                    </text>
                    <text x="15" y="55" fill="#6B7280" fontSize="10" fontFamily="Arial, sans-serif">
                      BUSINESS SYSTEMS PVT LTD
                    </text>
                  </svg>
                </div>
              </div>
              
              <div className="hidden sm:block h-10 w-px bg-gray-300"></div>
              
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-xl font-bold text-gray-900">MedCare Hospital</h1>
                  <p className="text-xs text-gray-500">Discharge Summary System</p>
                </div>
                <div className="sm:hidden">
                  <h1 className="text-lg font-bold text-gray-900">MedCare</h1>
                  <p className="text-xs text-gray-500">Hospital</p>
                </div>
              </div>
            </Link>
          </div>
          
          {showAuthButtons && (
            <div className="flex items-center space-x-4 ml-auto">
              <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                Sign In
              </Link>
              <Link to="/signup" className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors duration-200">
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default MedicalHeader;