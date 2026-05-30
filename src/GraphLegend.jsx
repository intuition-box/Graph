import React from "react";
import { NODE_COLORS } from "./nodeColors";

const GraphLegend = ({ showCreators = false }) => {
  const legendEntries = Object.entries(NODE_COLORS)
    .filter(([key]) => key !== 'CREATOR' || showCreators)
    .map(([key, color]) => ({
      role: key.toLowerCase(),
      color
    }));

  return (
    <div
      style={{
        position: "absolute",
        bottom: "20px",
        right: "10px",
        zIndex: 10,
        background: "#222",
        color: "#fff",
        padding: "10px",
        borderRadius: "4px",
        boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.2)",
        fontSize: "14px",
      }}
    >
      <h4 style={{ margin: "0 0 10px 0", fontSize: "16px" }}>Graph Legend</h4>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {legendEntries.map(({ role, color }) => (
          <li
            key={role}
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "5px",
            }}
          >
            <span
              style={{
                width: "15px",
                height: "15px",
                backgroundColor: color,
                borderRadius: "50%",
                display: "inline-block",
                marginRight: "10px",
              }}
            ></span>
            {role.charAt(0).toUpperCase() + role.slice(1)}
          </li>
        ))}
        <li
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "5px",
          }}
        >
          <span
            style={{
              width: "15px",
              height: "3px",
              background:
                "linear-gradient(90deg,#FF7300,#27D3C4,#A66BFF)",
              display: "inline-block",
              marginRight: "10px",
            }}
          ></span>
          Predicate (edge)
        </li>
      </ul>
    </div>
  );
};

export default GraphLegend;
