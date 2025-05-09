import React from "react";

const NavigationBar = ({
  onReset,
  onBack,
  onForward,
  canGoBack,
  canGoForward,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        top: "75px",
        left: "10px",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <button className="agent-btn" onClick={onReset} disabled={false}>
        Return to graph
      </button>
      <button className="agent-btn" onClick={onBack} disabled={!canGoBack}>
        Previous
      </button>
      <button
        className="agent-btn"
        onClick={onForward}
        disabled={!canGoForward}
      >
        Next
      </button>
    </div>
  );
};

export default NavigationBar;
