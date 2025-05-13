import React, { useState, useRef, useEffect } from "react";

const Popover = ({ trigger, children, position = "right" }) => {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getPositionClasses = () => {
    switch (position) {
      case "left":
        return "right-full mr-2";
      case "right":
        return "left-full ml-2";
      case "top":
        return "bottom-full mb-2";
      case "bottom":
        return "top-full mt-2";
      default:
        return "left-full ml-2";
    }
  };

  return (
    <div className="relative inline-block">
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div
          ref={popoverRef}
          className={`absolute z-50 ${getPositionClasses()} w-80 p-4 rounded-md border bg-white shadow-lg`}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default Popover;
