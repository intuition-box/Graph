import React from "react";
import { NODE_COLORS } from "./nodeColors";

const GraphLegend = () => {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 80,
        right: 30,
        zIndex: 1000,
        background: "#18181b",
        borderRadius: "10px",
        border: "2px solid #ffd32a",
        padding: "16px 24px",
        boxShadow: "0 8px 30px rgba(0, 0, 0, 0.5)",
      }}
    >
      <h4
        style={{
          margin: "0 0 16px 0",
          fontSize: "18px",
          color: "#ffd32a",
          fontWeight: "bold",
          letterSpacing: "0.5px",
        }}
      >
        Graph Legend
      </h4>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <li
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            color: "#fff",
          }}
        >
          <span
            style={{
              width: "20px",
              height: "20px",
              backgroundColor: NODE_COLORS.SUBJECT,
              borderRadius: "50%",
              display: "inline-block",
              boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
            }}
          ></span>
          <span style={{ fontSize: "15px" }}>Subject</span>
        </li>
        <li
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            color: "#fff",
          }}
        >
          <span
            style={{
              width: "20px",
              height: "20px",
              backgroundColor: NODE_COLORS.OBJECT,
              borderRadius: "4px",
              display: "inline-block",
              boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
            }}
          ></span>
          <span style={{ fontSize: "15px" }}>Object</span>
        </li>
        <li
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            color: "#fff",
          }}
        >
          <span
            style={{
              width: "24px",
              height: "12px",
              backgroundColor: NODE_COLORS.PREDICATE,
              borderRadius: "4px",
              display: "inline-block",
              boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
            }}
          ></span>
          <span style={{ fontSize: "15px" }}>Predicate</span>
        </li>
      </ul>
    </div>
  );
};

export default GraphLegend;
