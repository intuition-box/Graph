import React from "react";

const ViewModeSelector = ({ viewMode, onViewModeChange }) => {
  return (
    <div
      className="agent-navbar"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        background: "#18181b",
        border: "2px solid #ffd32a",
        borderRadius: "10px",
        padding: "6px 16px",
        color: "#ffd32a",
        fontWeight: "bold",
        fontSize: "15px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
      }}
    >
      <label htmlFor="viewMode" style={{ color: "#ffd32a", marginRight: 8 }}>
        View Mode:
      </label>
      <select
        id="viewMode"
        value={viewMode}
        onChange={(e) => onViewModeChange(e.target.value)}
        style={{
          background: "#232326",
          color: "#ffd32a",
          border: "1.5px solid #ffd32a",
          borderRadius: 6,
          padding: "4px 10px",
          fontWeight: "bold",
          fontSize: 15,
          outline: "none",
          cursor: "pointer",
        }}
      >
        <option value="2D">2D</option>
        <option value="3D">3D</option>
        <option value="VR">VR</option>
      </select>
    </div>
  );
};

export default ViewModeSelector;
