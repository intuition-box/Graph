import React from "react";

const ViewModeSelector = ({
  viewMode,
  onViewModeChange,
}) => {
  return (
    <div
      className="agent-navbar"
      style={{ display: "flex", alignItems: "center", gap: "10px" }}
    >
      <label htmlFor="viewMode">View Mode:</label>
      <select
        id="viewMode"
        value={viewMode}
        onChange={(e) => onViewModeChange(e.target.value)}
      >
        <option value="2D">2D</option>
        <option value="3D">3D</option>
        <option value="VR">VR</option>
      </select>
    </div>
  );
};

export default ViewModeSelector;
