import React from "react";
import iconDocument from "../../../assets/logo.svg";
import "./Header.scss";
import { Link } from "react-router-dom";

const Header: React.FC = () => {
  return (
    <header className="bg-[#151F28] px-6 flex items-center justify-between fixed top-0 w-full h-16 z-50">
      <Link to="/">
        <img src={iconDocument} alt="Logo" className="w-10 cursor-pointer" />
      </Link>
    </header>
  );
};

export default Header;
