import React, { useEffect, useState } from "react";
import { NODE_COLORS } from "./nodeColors";

// Treat narrow viewports as mobile so the legend can collapse to a small ⓘ chip
// (mirroring the Focus legend) instead of permanently covering the graph corner.
const MOBILE_BP = 768;
const isMobileViewport = () =>
  typeof window !== "undefined" && window.innerWidth <= MOBILE_BP;

const GraphLegend = ({ showCreators = false }) => {
  const legendEntries = Object.entries(NODE_COLORS)
    .filter(([key]) => key !== 'CREATOR' || showCreators)
    .map(([key, color]) => ({
      role: key.toLowerCase(),
      color
    }));

  // Mobile: start collapsed to a small ⓘ chip; the toggle expands the card.
  // Desktop is unaffected (toggle hidden via CSS, body always shown).
  const [isMobile, setIsMobile] = useState(isMobileViewport);
  const [open, setOpen] = useState(() => !isMobileViewport());
  useEffect(() => {
    const onResize = () => setIsMobile(isMobileViewport());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const collapsed = isMobile && !open;

  return (
    <div
      className={`graph-legend${collapsed ? " collapsed" : ""}`}
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
      <button
        type="button"
        className="graph-legend-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={open ? "Hide legend" : "Show legend"}
      >
        {open ? "✕" : "ⓘ"}
      </button>
      {!collapsed && (
        <>
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
        </>
      )}
    </div>
  );
};

export default GraphLegend;
