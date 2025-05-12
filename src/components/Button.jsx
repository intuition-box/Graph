import React from "react";

const Button = ({ children, onClick, className = "", variant = "default" }) => {
  const baseClasses =
    "px-4 py-2 rounded-md font-medium transition-colors duration-200";

  const variantClasses = {
    default: "bg-gray-100 hover:bg-gray-200 text-gray-900",
    primary: "bg-blue-600 hover:bg-blue-700 text-white",
    secondary: "bg-gray-600 hover:bg-gray-700 text-white",
  };

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

export default Button;
