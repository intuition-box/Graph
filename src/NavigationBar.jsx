import React from "react";

const navBtnStyle = {
  background: "#232326",
  color: "#ffd32a",
  border: "2px solid #ffd32a",
  borderRadius: 12,
  width: 150,
  height: 44,
  fontSize: 16,
  fontWeight: "bold",
  boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
  cursor: "pointer",
  marginBottom: 8,
  marginTop: 0,
  textTransform: "uppercase",
};

const NavigationBar = ({
  onReset,
  onBack,
  onForward,
  canGoBack,
  canGoForward,
  onMyView,
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
      <button style={navBtnStyle} onClick={onReset} disabled={false}>
        Return to graph
      </button>
      <button style={navBtnStyle} onClick={onMyView}>
        My View
      </button>
      <button
        style={{ ...navBtnStyle, opacity: !canGoBack ? 0.5 : 1 }}
        onClick={onBack}
        disabled={!canGoBack}
      >
        Previous
      </button>
      <button
        style={{ ...navBtnStyle, opacity: !canGoForward ? 0.5 : 1 }}
        onClick={onForward}
        disabled={!canGoForward}
      >
        Next
      </button>
    </div>
  );
};

export default NavigationBar;
