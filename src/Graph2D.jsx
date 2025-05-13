import React, { useRef, useState, useEffect } from "react";
import { ForceGraph2D } from "react-force-graph";
import { NODE_COLORS } from "./nodeColors";
import NodeDetailsSidebar from "./NodeDetailsSidebar";

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

const Graph2D = ({ 
  graphData, 
  onNodeClick, 
  onEngineStop, 
  fgRef, 
  tabs, 
  activeTab, 
  onTabChange, 
  children,
  drawerOpen,
  drawerContent,
  onDrawerClose,
  sidebarOpen,
  sidebarContent,
  onSidebarClose,
  selectedTriple,
  endpoint,
}) => {
  const containerRef = useRef();
  const [hoveredLink, setHoveredLink] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 100, height: 100 });

  // Gérer le redimensionnement avec useEffect
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
      style={{ 
        position: "relative",
        width: "100%", 
        height: "100%",
        overflow: "hidden"
      }}
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
        width={dimensions.width}
        height={dimensions.height}
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
        onNodeClick={(node) => {
          console.log("Node clicked inside Graph2D:", node);
          onNodeClick && onNodeClick(node);
        }}
        onEngineStop={onEngineStop}
        onLinkHover={setHoveredLink}
        onBackgroundClick={() => {
          setHoveredLink(null);
          // Ne pas désélectionner le nœud lors d'un clic sur l'arrière-plan
          // car cela pourrait masquer le NodeDetailsSidebar
        }}
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
      
      {/* Afficher le NodeDetailsSidebar comme dans GraphVR */}
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
      
      {/* Affichage de la barre de navigation en bas comme surcouche */}
      {tabs && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 2000,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 36,
            padding: "0 0 4px 0",
            height: 54,
          }}
        >
          {tabs.map((tab) => (
            <div
              key={tab.key || "map"}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                cursor: "pointer",
                minWidth: 120,
              }}
              onClick={() => onTabChange(tab.key)}
            >
              <span
                style={{
                  color: activeTab === tab.key ? "#ffd32a" : "#fff",
                  fontWeight: activeTab === tab.key ? "bold" : "normal",
                  fontSize: 17,
                  letterSpacing: 0.5,
                  padding: "8px 0 2px 0",
                  transition: "color 0.2s, font-weight 0.2s",
                }}
              >
                {tab.label}
              </span>
              <div
                style={{
                  height: 3,
                  width: "80%",
                  background: activeTab === tab.key ? "#ffd32a" : "transparent",
                  borderRadius: 2,
                  transition: "background 0.2s",
                }}
              />
            </div>
          ))}
        </div>
      )}
      
      {/* Rendu du Drawer du bas */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: drawerOpen ? "33.33vh" : 0,
          backgroundColor: "#18181b",
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          transition: "height 0.35s cubic-bezier(0.4, 1.3, 0.5, 1)",
          zIndex: 1300,
          boxShadow: "0 -2px 16px rgba(0, 0, 0, 0.18)",
          border: "2px solid #ffd32a",
          overflow: "hidden",
        }}
      >
        {drawerOpen && (
          <>
            <button
              style={{
                background: "none",
                border: "none",
                color: "#ffd32a",
                fontSize: 32,
                position: "absolute",
                top: 10,
                right: 18,
                cursor: "pointer",
                zIndex: 1302,
                transition: "color 0.2s",
              }}
              onClick={onDrawerClose}
            >
              ×
            </button>
            <div
              style={{
                padding: "48px 24px 24px 24px",
                overflowY: "auto",
                height: "100%",
                color: "#ffd32a",
              }}
            >
              {drawerContent}
            </div>
          </>
        )}
      </div>
      
      {/* Rendu du SidebarDrawer */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: sidebarOpen ? "16.67vw" : 0,
          minWidth: sidebarOpen ? "250px" : 0,
          backgroundColor: "#18181b",
          borderTopRightRadius: 18,
          borderBottomRightRadius: 18,
          transition: "width 0.35s cubic-bezier(0.4, 1.3, 0.5, 1)",
          zIndex: 1300,
          boxShadow: "2px 0 16px rgba(0, 0, 0, 0.18)",
          border: "2px solid #ffd32a",
          overflow: "hidden",
        }}
      >
        {sidebarOpen && (
          <>
            <button
              style={{
                background: "none",
                border: "none",
                color: "#ffd32a",
                fontSize: 32,
                position: "absolute",
                top: 10,
                right: 18,
                cursor: "pointer",
                zIndex: 1302,
                transition: "color 0.2s",
              }}
              onClick={onSidebarClose}
            >
              ×
            </button>
            <div
              style={{
                padding: "48px 24px 24px 24px",
                overflowY: "auto",
                height: "100%",
                color: "#ffd32a",
              }}
            >
              {sidebarContent}
            </div>
          </>
        )}
      </div>

      {/* Overlay pour le clic en dehors */}
      {(drawerOpen || sidebarOpen) && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.35)",
            zIndex: 1200,
            pointerEvents: "auto",
          }}
          onClick={drawerOpen ? onDrawerClose : onSidebarClose}
        />
      )}
      
      {/* Rendu de tout contenu enfant comme surcouche */}
      <div style={{ position: "relative", zIndex: 2000 }}>
        {children}
      </div>
    </div>
  );
};

export default Graph2D;
