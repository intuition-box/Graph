import React, { useEffect } from "react";
import "../App.css";

export default function SidebarDrawer({
  open,
  onClose,
  children,
  width = 350,
}) {
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
        className={`sidebar-drawer-panel${open ? " open" : ""}`}
        style={{ width }}
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
