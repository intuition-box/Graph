import React from "react";

const FilterBar = ({
  subjectFilter,
  predicateFilter,
  objectFilter,
  onFilterChange,
  onReset,
  onClose,
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#18181b",
        padding: "16px 24px",
        borderRadius: "10px",
        border: "2px solid #ffd32a",
        boxShadow: "0 8px 30px rgba(0, 0, 0, 0.5)",
        position: "relative",
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          background: "none",
          border: "none",
          color: "#ffd32a",
          fontSize: 20,
          cursor: "pointer",
          padding: 0,
          lineHeight: 1,
          width: 24,
          height: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2,
        }}
        aria-label="Close filters"
      >
        ×
      </button>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label
            style={{ color: "#ffd32a", fontSize: "14px", fontWeight: "bold" }}
          >
            Subject
          </label>
          <input
            type="text"
            value={subjectFilter}
            onChange={(e) => onFilterChange("subject", e.target.value)}
            placeholder="Filter by subject..."
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #ffd32a",
              fontSize: "14px",
              width: "200px",
              background: "#232326",
              color: "#fff",
              transition: "border-color 0.2s",
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label
            style={{ color: "#ffd32a", fontSize: "14px", fontWeight: "bold" }}
          >
            Predicate
          </label>
          <input
            type="text"
            value={predicateFilter}
            onChange={(e) => onFilterChange("predicate", e.target.value)}
            placeholder="Filter by predicate..."
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #ffd32a",
              fontSize: "14px",
              width: "200px",
              background: "#232326",
              color: "#fff",
              transition: "border-color 0.2s",
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label
            style={{ color: "#ffd32a", fontSize: "14px", fontWeight: "bold" }}
          >
            Object
          </label>
          <input
            type="text"
            value={objectFilter}
            onChange={(e) => onFilterChange("object", e.target.value)}
            placeholder="Filter by object..."
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #ffd32a",
              fontSize: "14px",
              width: "200px",
              background: "#232326",
              color: "#fff",
              transition: "border-color 0.2s",
            }}
          />
        </div>
        <button
          style={{
            background: "#ffd32a",
            color: "#18181b",
            border: "none",
            borderRadius: "8px",
            padding: "8px 24px",
            fontSize: "14px",
            fontWeight: "bold",
            cursor: "pointer",
            textTransform: "uppercase",
            transition: "background 0.2s, transform 0.1s",
            alignSelf: "flex-start",
            marginTop: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#ffe066";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#ffd32a";
            e.currentTarget.style.transform = "translateY(0)";
          }}
          onClick={onReset}
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default FilterBar;
