import React, { useRef, useState } from "react";
import { ForceGraph2D } from "react-force-graph";
import { NODE_COLORS } from "./nodeColors";

const Graph2D = ({ graphData, onNodeClick, onEngineStop, fgRef }) => {
  const containerRef = useRef();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hoveredLink, setHoveredLink] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);

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
          const size = (44 / globalScale) * Math.pow(globalScale, 0.15);
          if (node.type === "object") {
            if (node.image) {
              ctx.save();
              ctx.beginPath();
              ctx.rect(node.x - size / 2, node.y - size / 2, size, size);
              ctx.closePath();
              ctx.strokeStyle = node.color;
              ctx.lineWidth = 3 / globalScale;
              ctx.stroke();
              ctx.clip();
              if (!node.__img) {
                const img = new window.Image();
                img.src = node.image;
                img.onload = () => {
                  node.__imgLoaded = true;
                  if (fgRef && fgRef.current && fgRef.current.emit)
                    fgRef.current.emit("redraw");
                };
                node.__img = img;
                node.__imgLoaded = false;
              }
              if (node.__imgLoaded) {
                ctx.drawImage(
                  node.__img,
                  node.x - size / 2,
                  node.y - size / 2,
                  size,
                  size
                );
              } else {
                ctx.fillStyle = node.color || "#888";
                ctx.fillRect(node.x - size / 2, node.y - size / 2, size, size);
              }
              ctx.restore();
            } else {
              ctx.save();
              ctx.beginPath();
              ctx.rect(node.x - size / 2, node.y - size / 2, size, size);
              ctx.closePath();
              ctx.fillStyle = node.color + "CC";
              ctx.fill();
              ctx.strokeStyle = node.color;
              ctx.lineWidth = 3 / globalScale;
              ctx.stroke();
              const letter = (node.label || "?").charAt(0).toUpperCase();
              const fontSize = 20 / globalScale;
              ctx.font = `bold ${fontSize}px Sans-Serif`;
              ctx.fillStyle = "#fff";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(letter, node.x, node.y + size * 0.04);
              ctx.restore();
            }
          } else {
            if (node.image) {
              if (!node.__img) {
                const img = new window.Image();
                img.src = node.image;
                img.onload = () => {
                  node.__imgLoaded = true;
                  if (fgRef && fgRef.current && fgRef.current.emit)
                    fgRef.current.emit("redraw");
                };
                node.__img = img;
                node.__imgLoaded = false;
              }
              ctx.save();
              ctx.beginPath();
              ctx.arc(node.x, node.y, size / 2, 0, 2 * Math.PI, false);
              ctx.closePath();
              ctx.lineWidth = 3 / globalScale;
              ctx.strokeStyle = node.color;
              ctx.stroke();
              ctx.clip();
              if (node.__imgLoaded) {
                ctx.drawImage(
                  node.__img,
                  node.x - size / 2,
                  node.y - size / 2,
                  size,
                  size
                );
              } else {
                ctx.fillStyle = node.color || "#888";
                ctx.fill();
              }
              ctx.restore();
            } else {
              ctx.save();
              ctx.beginPath();
              ctx.arc(node.x, node.y, size / 2, 0, 2 * Math.PI, false);
              ctx.closePath();
              ctx.fillStyle = node.color + "CC";
              ctx.fill();
              ctx.strokeStyle = node.color;
              ctx.lineWidth = 3 / globalScale;
              ctx.stroke();
              const letter = (node.label || "?").charAt(0).toUpperCase();
              const fontSize = 20 / globalScale;
              ctx.font = `bold ${fontSize}px Sans-Serif`;
              ctx.fillStyle = "#fff";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(letter, node.x, node.y + size * 0.04);
              ctx.restore();
            }
          }
        }}
        nodePointerAreaPaint={(node, color, ctx, globalScale) => {
          const size = (44 / globalScale) * Math.pow(globalScale, 0.15);
          ctx.fillStyle = color;
          if (node.type === "object") {
            ctx.beginPath();
            ctx.rect(node.x - size / 2, node.y - size / 2, size, size);
            ctx.closePath();
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.arc(node.x, node.y, size / 2, 0, 2 * Math.PI, false);
            ctx.closePath();
            ctx.fill();
          }
        }}
        linkColor={() => "rgba(255, 211, 42, 0.15)"}
        linkDirectionalParticles={1}
        linkDirectionalParticleSpeed={0.01}
        linkDirectionalParticleColor={() => "rgba(255,255,255,0.5)"}
        nodeAutoColorBy="type"
        onNodeClick={onNodeClick}
        onEngineStop={onEngineStop}
        onNodeHover={setHoveredNode}
        onLinkHover={setHoveredLink}
        onBackgroundClick={() => {
          setHoveredLink(null);
          setHoveredNode(null);
        }}
        onZoom={() => {
          setHoveredLink(null);
          setHoveredNode(null);
        }}
      />
      {hoveredLink && hoveredLink.label ? (
        <div
          style={{
            position: "absolute",
            left: mousePos.x + 18,
            top: mousePos.y - 10,
            background: NODE_COLORS.PREDICATE,
            color: "#fff",
            border: `1.5px solid ${NODE_COLORS.PREDICATE}`,
            borderRadius: 8,
            padding: "6px 14px",
            fontSize: 15,
            fontWeight: "bold",
            zIndex: 10001,
            boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            maxWidth: 260,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {hoveredLink.label}
        </div>
      ) : hoveredNode && hoveredNode.label ? (
        <div
          style={{
            position: "absolute",
            left: mousePos.x + 18,
            top: mousePos.y - 10,
            background: "#232326",
            color: "#fff",
            border: "1.5px solid #ffd32a",
            borderRadius: 8,
            padding: "6px 14px",
            fontSize: 15,
            fontWeight: "bold",
            zIndex: 10001,
            boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            maxWidth: 260,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {hoveredNode.label}
        </div>
      ) : null}
    </div>
  );
};

export default Graph2D;
