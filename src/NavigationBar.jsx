import React from "react";
import { PiGraphLight } from "react-icons/pi";
import { FaArrowLeft, FaArrowRight, FaUser } from "react-icons/fa";

const navBtnStyle = {
  background: "#232326",
  color: "#ffd32a",
  border: "2px solid #ffd32a",
  borderRadius: 12,
  width: 44,
  height: 44,
  fontSize: 22,
  fontWeight: "bold",
  boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
  cursor: "pointer",
  marginBottom: 0,
  marginTop: 0,
  textTransform: "uppercase",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
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
        top: "18px",
        left: "18px",
        zIndex: 50,
        display: "flex",
        flexDirection: "row",
        gap: "12px",
        alignItems: "center",
      }}
    >
      <button style={navBtnStyle} onClick={onMyView} aria-label="Profile">
        <FaUser />
      </button>
      <button
        style={{ ...navBtnStyle, width: 54 }}
        onClick={onReset}
        aria-label="Return to graph"
      >
        <PiGraphLight size={28} />
      </button>
      <button
        style={{ ...navBtnStyle, opacity: !canGoBack ? 0.5 : 1 }}
        onClick={onBack}
        disabled={!canGoBack}
        aria-label="Previous"
      >
        <FaArrowLeft />
      </button>
      <button
        style={{ ...navBtnStyle, opacity: !canGoForward ? 0.5 : 1 }}
        onClick={onForward}
        disabled={!canGoForward}
        aria-label="Next"
      >
        <FaArrowRight />
      </button>
    </div>
  );
};

export default NavigationBar;
