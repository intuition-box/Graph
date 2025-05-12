import React, { useEffect } from "react";
import "../App.css";

export default function Drawer({ open, onClose, children, height = 400 }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <div
        className={`drawer-backdrop${open ? " open" : ""}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <div
        className={`drawer-panel${open ? " open" : ""}`}
        style={{ height }}
        role="dialog"
        aria-modal="true"
      >
        <button
          className="drawer-close-btn"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <div className="drawer-content">{children}</div>
      </div>
    </>
  );
}
