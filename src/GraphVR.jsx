import React, { useEffect, useRef } from "react";
import ForceGraphVR from "3d-force-graph-vr";

const GraphVR = ({ graphData, onNodeClick }) => {
  const graphRef = useRef();

  useEffect(() => {
    if (graphRef.current) {
      const graph = ForceGraphVR()(graphRef.current);

      graph.graphData(graphData);

      graph
        .nodeLabel((node) => node.label || node.id)
        .nodeAutoColorBy("group");

      // Attach click handler if provided
      if (onNodeClick) {
        graph.onNodeClick(onNodeClick);
      }
    }
  }, [graphData, onNodeClick]);

  return (
    <div
      ref={graphRef}
      style={{ width: "100vw", height: "100vh", overflow: "hidden" }}
    />
  );
};

export default GraphVR;
