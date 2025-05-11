import React from "react";

const FilterBar = ({
  subjectFilter,
  objectFilter,
  onFilterChange,
  onReset,
}) => {
  return (
    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
      <input
        className="agent-navbar"
        type="text"
        value={subjectFilter}
        onChange={(e) => onFilterChange("subject", e.target.value)}
        placeholder="Subject"
        style={{
          padding: "5px",
          borderRadius: "4px",
          border: "1px solid #ffd32a",
          fontSize: "14px",
          width: "150px",
          background: "#232326",
          color: "#fff",
        }}
      />
      <input
        className="agent-navbar"
        type="text"
        value={objectFilter}
        onChange={(e) => onFilterChange("object", e.target.value)}
        placeholder="Object"
        style={{
          padding: "5px",
          borderRadius: "4px",
          border: "1px solid #ffd32a",
          fontSize: "14px",
          width: "150px",
          background: "#232326",
          color: "#fff",
        }}
      />
      <button
        style={{
          background: "#232326",
          color: "#ffd32a",
          border: "2px solid #ffd32a",
          borderRadius: 12,
          width: 120,
          height: 40,
          fontSize: 15,
          fontWeight: "bold",
          boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
          cursor: "pointer",
          textTransform: "uppercase",
        }}
        onClick={onReset}
      >
        Reset
      </button>
    </div>
  );
};

export default FilterBar;
