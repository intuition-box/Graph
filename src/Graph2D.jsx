import React, { useRef, useState } from "react";
import { ForceGraph2D } from "react-force-graph";
import { NODE_COLORS } from "./nodeColors";

const tooltipStyle = {
  position: "absolute",
  pointerEvents: "none",
  background: NODE_COLORS.PREDICATE,
  color: "#fff",
  border: `2px solid ${NODE_COLORS.PREDICATE}`,
  borderRadius: 8,
  padding: "6px 14px",
  fontSize: 15,
  fontWeight: "bold",
  zIndex: 10000,
  boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
  whiteSpace: "nowrap",
  maxWidth: 260,
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const TOOLTIP_OFFSET_X = 16;
const TOOLTIP_OFFSET_Y = 32;

const Graph2D = ({ graphData, onNodeClick, onEngineStop, fgRef }) => {
  const containerRef = useRef();
  const [hoveredLink, setHoveredLink] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Ajuste la position du tooltip pour qu'il reste dans le conteneur
  const getTooltipPosition = () => {
    if (!containerRef.current) return { left: mousePos.x, top: mousePos.y };
    const bounds = containerRef.current.getBoundingClientRect();
    const tooltipWidth = 180; // Largeur max estimée du tooltip
    const tooltipHeight = 36; // Hauteur estimée du tooltip
    let left = mousePos.x + TOOLTIP_OFFSET_X;
    let top = mousePos.y - TOOLTIP_OFFSET_Y;
    if (left + tooltipWidth > bounds.width)
      left = bounds.width - tooltipWidth - 8;
    if (left < 0) left = 8;
    if (top < 0) top = mousePos.y + TOOLTIP_OFFSET_Y;
    if (top + tooltipHeight > bounds.height)
      top = bounds.height - tooltipHeight - 8;
    return { left, top };
  };

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%", height: "100%" }}
      onMouseMove={(e) => {
        if (containerRef.current) {
          const bounds = containerRef.current.getBoundingClientRect();
          setMousePos({
            x: e.clientX - bounds.left,
            y: e.clientY - bounds.top,
          });
        }
      }}
    >
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const label = node.label || "";
          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px Sans-Serif`;

          const textWidth = ctx.measureText(label).width;
          const padding = 10 / globalScale;
          const radius = 5 / globalScale;

          ctx.fillStyle = node.color + "CC";
          const x = node.x - textWidth / 2 - padding;
          const y = node.y - fontSize / 2 - padding;
          const width = textWidth + padding * 2;
          const height = fontSize + padding * 2;
          const bckgDimensions = [width, height];

          ctx.beginPath();
          ctx.arc(x + radius, y + radius, radius, Math.PI, 1.5 * Math.PI);
          ctx.arc(
            x + width - radius,
            y + radius,
            radius,
            1.5 * Math.PI,
            2 * Math.PI
          );
          ctx.arc(
            x + width - radius,
            y + height - radius,
            radius,
            0,
            0.5 * Math.PI
          );
          ctx.arc(
            x + radius,
            y + height - radius,
            radius,
            0.5 * Math.PI,
            Math.PI
          );
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = "#fff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, node.x, node.y);

          node.__bckgDimensions = bckgDimensions;
        }}
        nodePointerAreaPaint={(node, color, ctx) => {
          ctx.fillStyle = color;
          const bckgDimensions = node.__bckgDimensions;
          bckgDimensions &&
            ctx.fillRect(
              node.x - bckgDimensions[0] / 2,
              node.y - bckgDimensions[1] / 2,
              ...bckgDimensions
            );
        }}
        linkColor={() => "rgba(255, 211, 42, 0.15)"}
        linkDirectionalParticles={1}
        linkDirectionalParticleSpeed={0.01}
        linkDirectionalParticleColor={() => "rgba(255,255,255,0.5)"}
        nodeAutoColorBy="type"
        onNodeClick={onNodeClick}
        onEngineStop={onEngineStop}
        onLinkHover={setHoveredLink}
        onBackgroundClick={() => setHoveredLink(null)}
        onZoom={() => setHoveredLink(null)}
      />
      {hoveredLink && hoveredLink.label && (
        <div
          style={{
            ...tooltipStyle,
            ...getTooltipPosition(),
            pointerEvents: "none",
          }}
        >
          {hoveredLink.label}
        </div>
      )}
    </div>
  );
};

export default Graph2D;
