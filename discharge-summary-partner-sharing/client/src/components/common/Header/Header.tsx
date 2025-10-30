import React from "react";
import iconDocument from "../../../assets/logo.svg";
import "./Header.scss";
import { Link } from "react-router-dom";
import LogoutButton from "../LogoutButton";

const Header: React.FC = () => {
  const userEmail = localStorage.getItem('userEmail');
  
  return (
    <header className="bg-[#151F28] px-6 flex items-center justify-between fixed top-0 w-full h-16 z-50">
      <Link to="/admin">
        <img src={iconDocument} alt="Logo" className="w-10 cursor-pointer" />
      </Link>
      
      <div className="flex items-center space-x-4">
        {userEmail && (
          <span className="text-white text-sm">
            Welcome, {userEmail}
          </span>
        )}
        <LogoutButton />
      </div>
    </header>
  );
};

export default Header;
