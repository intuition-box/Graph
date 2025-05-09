import React from "react";

const ViewModeSelector = ({
  viewMode,
  onViewModeChange,
  showCreators,
  onShowCreatorsChange,
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

      <label style={{ marginLeft: "10px" }}>
        Show Creators
        <input
          type="checkbox"
          checked={showCreators}
          onChange={(e) => onShowCreatorsChange(e.target.checked)}
          style={{ marginLeft: "8px" }}
        />
      </label>
    </div>
  );
};

export default ViewModeSelector;
