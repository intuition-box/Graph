import React from "react";
import { ForceGraph2D } from "react-force-graph";

const Graph2D = ({ graphData, onNodeClick, onEngineStop, fgRef }) => {
  return (
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
      linkDirectionalParticleSpeed={0.02}
      linkDirectionalParticleColor={() => "#fff"}
      nodeAutoColorBy="type"
      onNodeClick={onNodeClick}
      onEngineStop={onEngineStop}
    />
  );
};

export default Graph2D;
