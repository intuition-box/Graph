import React from "react";
import { PiGraphLight } from "react-icons/pi";
import { FaArrowLeft, FaArrowRight, FaUser } from "react-icons/fa";

const navBtnStyle = {
  background: "#ffd32a",
  color: "#18181b",
  border: "none",
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
  transition: "background 0.2s, color 0.2s, transform 0.1s",
};

const navBtnHoverStyle = {
  background: "#ffe066",
  color: "#18181b",
  transform: "translateY(-2px) scale(1.03)",
};

const NavigationBar = ({
  onReset,
  onBack,
  onForward,
  canGoBack,
  canGoForward,
  onMyView,
}) => {
  // Gestion du hover avec React (sinon utiliser :hover en CSS)
  const [hovered, setHovered] = React.useState("");
  const getBtnStyle = (key) =>
    hovered === key ? { ...navBtnStyle, ...navBtnHoverStyle } : navBtnStyle;

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
      <button
        style={getBtnStyle("profile")}
        onClick={onMyView}
        aria-label="Profile"
        onMouseEnter={() => setHovered("profile")}
        onMouseLeave={() => setHovered("")}
      >
        <FaUser />
      </button>
      <button
        style={{ ...getBtnStyle("graph"), width: 54 }}
        onClick={onReset}
        aria-label="Return to graph"
        onMouseEnter={() => setHovered("graph")}
        onMouseLeave={() => setHovered("")}
      >
        <PiGraphLight size={28} />
      </button>
      <button
        style={{ ...getBtnStyle("prev"), opacity: !canGoBack ? 0.5 : 1 }}
        onClick={onBack}
        disabled={!canGoBack}
        aria-label="Previous"
        onMouseEnter={() => setHovered("prev")}
        onMouseLeave={() => setHovered("")}
      >
        <FaArrowLeft />
      </button>
      <button
        style={{ ...getBtnStyle("next"), opacity: !canGoForward ? 0.5 : 1 }}
        onClick={onForward}
        disabled={!canGoForward}
        aria-label="Next"
        onMouseEnter={() => setHovered("next")}
        onMouseLeave={() => setHovered("")}
      >
        <FaArrowRight />
      </button>
    </div>
  );
};

export default NavigationBar;
