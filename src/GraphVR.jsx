import React, { useEffect, useRef, useState } from "react";
import ForceGraphVR from "3d-force-graph-vr";
import NodeDetailsSidebar from "./NodeDetailsSidebar";

const GraphVR = ({ graphData, onNodeClick, onBack, onForward, selectedTriple, endpoint }) => {
  const containerRef = useRef();
  const graphRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 100, height: 100 });

  // Gérer le redimensionnement
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    // Mettre à jour les dimensions initiales
    updateDimensions();
    
    // Ajouter un écouteur d'événement pour le redimensionnement
    window.addEventListener('resize', updateDimensions);
    
    // Nettoyer l'écouteur d'événement lors du démontage
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (graphRef.current && dimensions.width > 0 && dimensions.height > 0) {
      const graph = ForceGraphVR()(graphRef.current);

      graph
        .width(dimensions.width)
        .height(dimensions.height)
        .graphData(graphData)
        .nodeLabel((node) => node.label || node.id)
        .nodeAutoColorBy("group");

      // Attach click handler if provided
      if (onNodeClick) {
        // Wrapper pour s'assurer que l'event est correctement passé
        graph.onNodeClick(node => {
          console.log("VR Node clicked inside Graph:", node);
          onNodeClick(node);
        });
      }
    }
  }, [graphData, onNodeClick, dimensions]);

  return (
    <div
      ref={containerRef}
      style={{ 
        position: "relative",
        width: "100%", 
        height: "100%", 
        overflow: "hidden" 
      }}
    >
      <div
        ref={graphRef}
        style={{ width: "100%", height: "100%" }}
      />
      
      {/* Navigation buttons */}
      <div style={{ position: "absolute", bottom: 20, left: 20, zIndex: 100 }}>
        <button 
          onClick={onBack}
          style={{
            background: "#ffd32a",
            color: "#18181b",
            border: "none",
            borderRadius: 8,
            padding: "10px 20px",
            marginRight: 10,
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          Back
        </button>
        <button 
          onClick={onForward}
          style={{
            background: "#ffd32a",
            color: "#18181b",
            border: "none",
            borderRadius: 8,
            padding: "10px 20px",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          Forward
        </button>
      </div>
      
      {/* Utiliser le vrai NodeDetailsSidebar à la place de notre info box simplifiée */}
      {selectedTriple && (
        <div style={{ 
          position: "absolute", 
          top: 80, 
          right: 30, 
          width: 350,
          zIndex: 9999,
          maxHeight: "80vh",
          background: "#18181b",
          borderRadius: "10px",
          border: "3px solid #ffd32a",
          boxShadow: "0 8px 30px rgba(0, 0, 0, 0.5)",
          overflowY: "auto"
        }}>
          <NodeDetailsSidebar
            triple={selectedTriple}
            endpoint={endpoint}
            onClose={() => onNodeClick(null)}
          />
        </div>
      )}
    </div>
  );
};

export default GraphVR;
