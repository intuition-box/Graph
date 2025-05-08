import React from "react";
import { NODE_COLORS } from "./nodeColors";

const GraphLegend = ({ showCreators = false }) => {
  return (
    <div
      className="agent-legend"
      style={{
        position: "absolute",
        bottom: "20px",
        right: "10px",
        zIndex: 10,
      }}
    >
      <h4 style={{ margin: "0 0 10px 0", fontSize: "16px" }}>Graph Legend</h4>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        <li
          style={{ display: "flex", alignItems: "center", marginBottom: "5px" }}
        >
          <span
            style={{
              width: "15px",
              height: "15px",
              backgroundColor: NODE_COLORS.SUBJECT,
              borderRadius: "50%",
              display: "inline-block",
              marginRight: "10px",
            }}
          ></span>
          Subject
        </li>
        <li
          style={{ display: "flex", alignItems: "center", marginBottom: "5px" }}
        >
          <span
            style={{
              width: "15px",
              height: "15px",
              backgroundColor: NODE_COLORS.PREDICATE,
              borderRadius: "50%",
              display: "inline-block",
              marginRight: "10px",
            }}
          ></span>
          Predicate
        </li>
        <li
          style={{ display: "flex", alignItems: "center", marginBottom: "5px" }}
        >
          <span
            style={{
              width: "15px",
              height: "15px",
              backgroundColor: NODE_COLORS.OBJECT,
              borderRadius: "50%",
              display: "inline-block",
              marginRight: "10px",
            }}
          ></span>
          Object
        </li>
        {showCreators && (
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
                height: "15px",
                backgroundColor: NODE_COLORS.CREATOR,
                borderRadius: "50%",
                display: "inline-block",
                marginRight: "10px",
              }}
            ></span>
            Creator
          </li>
        )}
      </ul>
    </div>
  );
};

export default GraphLegend;
