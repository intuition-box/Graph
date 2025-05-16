import React, { useRef, useState, useEffect } from "react";
import { ForceGraph3D } from "react-force-graph";
import SpriteText from "three-spritetext";
import { getNodeColor } from "./nodeColors";
import NodeDetailsSidebar from "./NodeDetailsSidebar";
import { NODE_COLORS } from "./nodeColors";
import * as THREE from "three";

const Graph3D = ({
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
  const [dimensions, setDimensions] = useState({ width: 100, height: 100 });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoveredLink, setHoveredLink] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [loadedImages, setLoadedImages] = useState(new Map());

  // Gérer le redimensionnement avec useEffect
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    // Mettre à jour les dimensions initiales
    updateDimensions();

    // Ajouter un écouteur d'événement pour le redimensionnement
    window.addEventListener("resize", updateDimensions);

    // Nettoyer l'écouteur d'événement lors du démontage
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Fonction pour charger une image
  const loadImage = (url) => {
    if (loadedImages.has(url)) {
      return loadedImages.get(url);
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    img.onload = () => {
      setLoadedImages((prev) => new Map(prev).set(url, img));
      if (fgRef.current) {
        fgRef.current.emit("redraw");
      }
    };
    return null;
  };

  // Précharger les images au montage du composant
  useEffect(() => {
    graphData.nodes.forEach((node) => {
      if (node.image) {
        loadImage(node.image);
      }
    });
  }, [graphData.nodes]);

  // Fonction pour créer un matériau avec image
  const createImageMaterial = (node) => {
    const img = loadedImages.get(node.image);
    if (!img) return null;

    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 128, 128);

    if (node.type === "object") {
      // Image carrée
      ctx.fillStyle = getNodeColor(node.type);
      ctx.fillRect(0, 0, 128, 128);
      const ratio = Math.max(128 / img.width, 128 / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      ctx.drawImage(img, 64 - w / 2, 64 - h / 2, w, h);
    } else {
      // Image circulaire
      ctx.beginPath();
      ctx.arc(64, 64, 64, 0, 2 * Math.PI);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = getNodeColor(node.type);
      ctx.fillRect(0, 0, 128, 128);
      const ratio = Math.max(128 / img.width, 128 / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      ctx.drawImage(img, 64 - w / 2, 64 - h / 2, w, h);
    }

    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
    });
  };

  // Fonction pour créer un matériau avec lettre
  const createLetterMaterial = (node) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 128, 128);

    if (node.type === "object") {
      ctx.fillStyle = getNodeColor(node.type);
      ctx.fillRect(0, 0, 128, 128);
    } else {
      ctx.beginPath();
      ctx.arc(64, 64, 64, 0, 2 * Math.PI);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = getNodeColor(node.type);
      ctx.fillRect(0, 0, 128, 128);
    }

    const label = (node.label || "?").substring(0, 3);
    ctx.font = "bold 72px Sans-Serif";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 64, 72);

    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
    });
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
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
      <ForceGraph3D
        ref={fgRef}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        controlType="fly"
        backgroundColor="rgba(0,0,0,0)"
        nodeLabel="label"
        onNodeClick={onNodeClick}
        linkColor={() => "rgba(255, 211, 42, 0.15)"}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.0025}
        linkDirectionalParticleColor={() => "rgba(255,255,255,0.5)"}
        nodeAutoColorBy="type"
        nodeThreeObject={(node) => {
          const size = 16;
          if (node.type === "object") {
            // --- Carré 2D (plan XY) ---
            const group = new THREE.Group();
            if (node.image) {
              // Canvas carré pour l'image
              const canvas = document.createElement("canvas");
              canvas.width = canvas.height = 128;
              const ctx = canvas.getContext("2d");
              ctx.clearRect(0, 0, 128, 128);
              // Charger l'image et la dessiner centrée/couverte
              const img = new window.Image();
              img.crossOrigin = "anonymous";
              img.src = node.image;
              img.onload = () => {
                const ratio = Math.max(128 / img.width, 128 / img.height);
                const w = img.width * ratio;
                const h = img.height * ratio;
                ctx.save();
                ctx.fillStyle = getNodeColor(node.type) + "CC";
                ctx.fillRect(0, 0, 128, 128); // fond/contour
                ctx.drawImage(img, 64 - w / 2, 64 - h / 2, w, h);
                ctx.restore();
                texture.needsUpdate = true;
              };
              // Sprite image carré
              const texture = new THREE.Texture(canvas);
              const material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
              });
              const plane = new THREE.Mesh(
                new THREE.PlaneGeometry(size, size),
                material
              );
              group.add(plane);
              return group;
            } else {
              // Lettre sur carré coloré
              const canvas = document.createElement("canvas");
              canvas.width = canvas.height = 128;
              const ctx = canvas.getContext("2d");
              ctx.clearRect(0, 0, 128, 128);
              ctx.fillStyle = getNodeColor(node.type) + "CC";
              ctx.fillRect(0, 0, 128, 128);
              const label = (node.label || "?").substring(0, 3);
              ctx.font = "bold 40px Sans-Serif";
              ctx.fillStyle = "#fff";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(label, 64, 72);
              const texture = new THREE.Texture(canvas);
              texture.needsUpdate = true;
              const material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
              });
              const plane = new THREE.Mesh(
                new THREE.PlaneGeometry(size, size),
                material
              );
              group.add(plane);
              return group;
            }
          } else {
            // --- Cercle 2D (plan XY) ---
            const group = new THREE.Group();
            if (node.image) {
              // Canvas rond pour l'image
              const canvas = document.createElement("canvas");
              canvas.width = canvas.height = 128;
              const ctx = canvas.getContext("2d");
              ctx.clearRect(0, 0, 128, 128);
              const img = new window.Image();
              img.crossOrigin = "anonymous";
              img.src = node.image;
              img.onload = () => {
                const ratio = Math.max(128 / img.width, 128 / img.height);
                const w = img.width * ratio;
                const h = img.height * ratio;
                ctx.save();
                ctx.beginPath();
                ctx.arc(64, 64, 64, 0, 2 * Math.PI);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(img, 64 - w / 2, 64 - h / 2, w, h);
                ctx.restore();
                texture.needsUpdate = true;
              };
              const texture = new THREE.Texture(canvas);
              const material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
              });
              const plane = new THREE.Mesh(
                new THREE.CircleGeometry(size / 2, 48),
                material
              );
              group.add(plane);
              return group;
            } else {
              // Lettre sur cercle coloré
              const canvas = document.createElement("canvas");
              canvas.width = canvas.height = 128;
              const ctx = canvas.getContext("2d");
              ctx.clearRect(0, 0, 128, 128);
              ctx.save();
              ctx.beginPath();
              ctx.arc(64, 64, 64, 0, 2 * Math.PI);
              ctx.closePath();
              ctx.clip();
              ctx.fillStyle = getNodeColor(node.type) + "CC";
              ctx.fillRect(0, 0, 128, 128);
              ctx.restore();
              const label = (node.label || "?").substring(0, 3);
              ctx.font = "bold 40px Sans-Serif";
              ctx.fillStyle = "#fff";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(label, 64, 72);
              const texture = new THREE.Texture(canvas);
              texture.needsUpdate = true;
              const material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
              });
              const plane = new THREE.Mesh(
                new THREE.CircleGeometry(size / 2, 48),
                material
              );
              group.add(plane);
              return group;
            }
          }
        }}
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

      {/* Afficher le NodeDetailsSidebar */}
      {selectedTriple && (
        <div
          style={{
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
            overflowY: "auto",
          }}
        >
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
      <div style={{ position: "relative", zIndex: 2000 }}>{children}</div>

      {/* Tooltip pour les nœuds */}
      {hoveredNode && hoveredNode.label && (
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
      )}

      {/* Tooltip pour les liens */}
      {hoveredLink && hoveredLink.label && (
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
      )}
    </div>
  );
};

export default Graph3D;
