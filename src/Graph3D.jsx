import React from "react";
import { ForceGraph3D } from "react-force-graph";
import SpriteText from "three-spritetext";
import { getNodeColor } from "./nodeColors";

const Graph3D = ({ graphData, onNodeClick, onEngineStop, fgRef }) => {
  return (
    <ForceGraph3D
      ref={fgRef}
      graphData={graphData}
      controlType="fly"
      nodeLabel="label"
      onNodeClick={onNodeClick}
      linkColor={() => "rgba(255, 211, 42, 0.15)"}
      linkDirectionalParticles={2}
      linkDirectionalParticleSpeed={0.005}
      nodeAutoColorBy="type"
      nodeThreeObject={(node) => {
        const sprite = new SpriteText(node.label || "");
        sprite.backgroundColor = getNodeColor(node.type) + "CC";
        sprite.borderRadius = 1;
        sprite.padding = 1;
        sprite.color = "#fff";
        sprite.textHeight = 2;
        return sprite;
      }}
      onEngineStop={onEngineStop}
    />
  );
};

export default Graph3D;
