import React, { useEffect, useState, useCallback, useRef } from "react";
import { ForceGraph2D, ForceGraph3D } from "react-force-graph";
import SpriteText from "three-spritetext";
import { fetchTriples, fetchTriplesForNode } from "./api";
import { transformToGraphData } from "./graphData";
import { NODE_COLORS } from "./nodeColors";
import GraphLegend from "./GraphLegend";
import GraphVR from "./GraphVR";
import NodeDetailsSidebar from "./NodeDetailsSidebar";
import LoadingAnimation from "./LoadingAnimation";

const GraphVisualization = ({ endpoint }) => {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });

  const [initialGraphData, setInitialGraphData] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [viewMode, setViewMode] = useState("2D");
  const [selectedTriple, setSelectedTriple] = useState(null);
  const [showCreators, setShowCreators] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fgRef = useRef();
  const [graphHistory, setGraphHistory] = useState([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);

  // Filtres
  const [subjectFilter, setSubjectFilter] = useState("");
  const [predicateFilter, setPredicateFilter] = useState("");
  const [objectFilter, setObjectFilter] = useState("");

  // Charger les données
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const triples = await fetchTriples(endpoint);
        let baseGraphData = transformToGraphData(triples);

        // Ajouter les créateurs si le toggle est actif
        if (showCreators) {
          baseGraphData = enhanceGraphDataWithCreators(baseGraphData, triples);
        }

        setGraphData(baseGraphData);
        setInitialGraphData(baseGraphData);
      } catch (error) {
        console.error("Error loading graph data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [showCreators, endpoint]); // Reload when endpoint changes

  const resetGraph = () => {
    setGraphData(initialGraphData);
  };

  // Fonction pour ajouter les créateurs au graphe
  const enhanceGraphDataWithCreators = (graphData, triples) => {
    const creatorNodes = [];
    const creatorLinks = [];

    triples.forEach((triple) => {
      const entities = [triple.subject, triple.predicate, triple.object];

      entities.forEach((entity) => {
        if (entity.creatorId) {
          // Ajouter un nœud pour le créateur
          if (
            !creatorNodes.find(
              (node) => node.id === `creator-${entity.creatorId}`
            )
          ) {
            creatorNodes.push({
              id: `creator-${entity.creatorId}`,
              label: `${entity.creatorId}`,
              type: "creator",
              color: NODE_COLORS.CREATOR,
            });
          }

          // Ajouter un lien entre l'entité et son créateur
          creatorLinks.push({
            source: `creator-${entity.creatorId}`,
            target: entity.id,
            label: "created",
          });
        }
      });
    });

    return {
      nodes: [...graphData.nodes, ...creatorNodes],
      links: [...graphData.links, ...creatorLinks],
    };
  };

  const handleNodeClick = useCallback(
    async (node) => {
      if (fgRef.current) {
        try {
          // Sauvegarder la position actuelle du nœud
          const nodePosition = {
            x: node.x,
            y: node.y,
            z: node.z || 0, // En 2D, z sera 0
          };

          // Récupérer les nouveaux triplets
          const filteredTriples = await fetchTriplesForNode(node.id, endpoint);
          const newGraphData = transformToGraphData(filteredTriples);

          // Assigner la position sauvegardée au nœud correspondant dans le nouveau graphe
          const targetNode = newGraphData.nodes.find((n) => n.id === node.id);
          if (targetNode) {
            targetNode.x = nodePosition.x;
            targetNode.y = nodePosition.y;
            if (viewMode === "3D") targetNode.z = nodePosition.z;

            // Fixer le nœud en place pendant l'initialisation du graphe
            targetNode.fx = nodePosition.x;
            targetNode.fy = nodePosition.y;
            if (viewMode === "3D") targetNode.fz = nodePosition.z;
          }

          setSelectedTriple(node);

          // Sauvegarder l'état actuel dans l'historique
          setGraphHistory((prevHistory) => {
            const updatedHistory = prevHistory.slice(
              0,
              currentHistoryIndex + 1
            );
            updatedHistory.push({ graphData, selectedTriple }); // Ajouter l'état actuel du graphe et de NodeDetailsSidebar
            return updatedHistory;
          });
          setCurrentHistoryIndex((prevIndex) => prevIndex + 1);

          setGraphData(newGraphData);
        } catch (error) {
          console.error("Erreur lors de la récupération des triplets :", error);
        }
      }
    },
    [viewMode, graphData, currentHistoryIndex, endpoint, selectedTriple]
  );

  // Fit graph to view after initial render
  const handleEngineStop = useCallback(() => {
    if (isInitialLoad && fgRef.current) {
      setIsInitialLoad(false);
    }
  }, [isInitialLoad]);

  // Boutons Précédent et Suivant
  const goBack = () => {
    if (currentHistoryIndex > 0) {
      const { graphData, selectedTriple } =
        graphHistory[currentHistoryIndex - 1];
      setGraphData(graphData);
      setSelectedTriple(selectedTriple); // Récupérer l'état de NodeDetailsSidebar
      setCurrentHistoryIndex((prevIndex) => prevIndex - 1);
    }
  };

  const goForward = () => {
    if (currentHistoryIndex < graphHistory.length - 1) {
      const { graphData, selectedTriple } =
        graphHistory[currentHistoryIndex + 1];
      setGraphData(graphData);
      setSelectedTriple(selectedTriple); // Récupérer l'état de NodeDetailsSidebar
      setCurrentHistoryIndex((prevIndex) => prevIndex + 1);
    }
  };

  const applyFilters = () => {
    console.log("Applying filters...");
    console.log("Subject Filter:", subjectFilter);
    console.log("Predicate Filter:", predicateFilter);
    console.log("Object Filter:", objectFilter);

    // Vérification des liens pour déboguer
    console.log("Links before filtering:", graphData.links);

    const filteredLinks = graphData.links.filter((link) => {
      const subjectMatches =
        !subjectFilter ||
        (typeof link.source === "string"
          ? link.source.toLowerCase().includes(subjectFilter.toLowerCase())
          : link.source?.label
              ?.toLowerCase()
              .includes(subjectFilter.toLowerCase()));

      const predicateMatches =
        !predicateFilter ||
        (typeof link.label === "string"
          ? link.label.toLowerCase().includes(predicateFilter.toLowerCase())
          : false) || // Filtrage sur le prédicat
        (typeof link.source === "string"
          ? link.source.toLowerCase().includes(predicateFilter.toLowerCase())
          : link.source?.label
              ?.toLowerCase()
              .includes(predicateFilter.toLowerCase())) || // Filtrage aussi sur le sujet (source)
        (typeof link.target === "string"
          ? link.target.toLowerCase().includes(predicateFilter.toLowerCase())
          : link.target?.label
              ?.toLowerCase()
              .includes(predicateFilter.toLowerCase())); // Filtrage aussi sur l'objet (target)

      const objectMatches =
        !objectFilter ||
        (typeof link.target === "string"
          ? link.target.toLowerCase().includes(objectFilter.toLowerCase())
          : link.target?.label
              ?.toLowerCase()
              .includes(objectFilter.toLowerCase()));

      return subjectMatches && predicateMatches && objectMatches;
    });

    // Déboguer les liens filtrés
    console.log("Filtered Links:", filteredLinks);

    // Identifiez les nœuds impliqués dans les liens filtrés
    const filteredNodeIds = new Set(
      filteredLinks.flatMap((link) => [
        typeof link.source === "string" ? link.source : link.source?.id,
        typeof link.target === "string" ? link.target : link.target?.id,
      ])
    );

    // Filtrer les nœuds pour ne garder que ceux qui sont impliqués dans les liens filtrés
    const filteredNodes = graphData.nodes.filter((node) =>
      filteredNodeIds.has(node.id)
    );

    // Déboguer les nœuds filtrés
    console.log("Filtered Nodes:", filteredNodes);

    // Mettre à jour l'état avec les données filtrées
    setGraphData({ nodes: filteredNodes, links: filteredLinks });
  };

  const resetFilters = () => {
    setSubjectFilter("");
    setPredicateFilter("");
    setObjectFilter("");

    if (graphHistory.length)
      setGraphData(graphHistory[graphHistory.length - 1].graphData);
    else setGraphData(initialGraphData);
  };

  return (
    <div>
      {isLoading && <LoadingAnimation />}
      <div
        style={{
          position: "absolute",
          top: "75px",
          left: "10px",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <button className="agent-btn" onClick={resetGraph} disabled={false}>
          Return to graph
        </button>
        <button
          className="agent-btn"
          onClick={goBack}
          disabled={currentHistoryIndex <= 0}
        >
          Previous
        </button>
        <button
          className="agent-btn"
          onClick={goForward}
          disabled={currentHistoryIndex >= graphHistory.length - 1}
        >
          Next
        </button>
      </div>

      {/* Options en haut à gauche */}
      <div
        className="agent-navbar"
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          zIndex: 10,
        }}
      >
        <label htmlFor="viewMode">View Mode:</label>
        <select
          id="viewMode"
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value)}
        >
          <option value="2D">2D</option>
          <option value="3D">3D</option>
          <option value="VR">VR</option>
        </select>

        <label style={{ marginLeft: "10px" }}>
          Show Creators
          <input
            type="checkbox"
            checked={showCreators}
            onChange={(e) => setShowCreators(e.target.checked)}
            style={{ marginLeft: "8px" }}
          />
        </label>
        <input
          type="text"
          value={subjectFilter}
          onChange={(e) => {
            setSubjectFilter(e.target.value);
            applyFilters();
          }}
          placeholder="Subject"
        />
        <input
          type="text"
          value={predicateFilter}
          onChange={(e) => {
            setPredicateFilter(e.target.value);
            applyFilters();
          }}
          placeholder="Predicate"
        />
        <input
          type="text"
          value={objectFilter}
          onChange={(e) => {
            setObjectFilter(e.target.value);
            applyFilters();
          }}
          placeholder="Object"
        />
        <button onClick={resetFilters}>reset</button>
      </div>

      {/* Graphique 2D */}
      {viewMode === "2D" && (
        <ForceGraph2D
          ref={(el) => (fgRef.current = el)}
          graphData={graphData}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const label = node.label || "";
            const fontSize = 12 / globalScale;
            ctx.font = `${fontSize}px Sans-Serif`;

            // Measure text width for background
            const textWidth = ctx.measureText(label).width;
            const padding = 10 / globalScale; // Scale padding with zoom
            const radius = 5 / globalScale; // Scale border radius with zoom

            // Draw rounded rectangle backgrwound
            ctx.fillStyle = node.color + "CC";
            const x = node.x - textWidth / 2 - padding;
            const y = node.y - fontSize / 2 - padding;
            const width = textWidth + padding * 2;
            const height = fontSize + padding * 2;
            const bckgDimensions = [width, height];

            // Simple rounded rect using arcs (more performant than complex paths)
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

            // Draw text
            ctx.fillStyle = "#fff";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, node.x, node.y);

            node.__bckgDimensions = bckgDimensions; // to re-use in nodePointerAreaPaint
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
          linkColor={() => "#666"}
          linkDirectionalParticles={1}
          linkDirectionalParticleSpeed={0.02}
          linkDirectionalParticleColor={() => "#fff"}
          nodeAutoColorBy="type"
          onNodeClick={handleNodeClick}
          onEngineStop={handleEngineStop}
        />
      )}

      {/* Graphique 3D */}
      {viewMode === "3D" && (
        <ForceGraph3D
          ref={(el) => (fgRef.current = el)}
          graphData={graphData}
          controlType="fly"
          nodeLabel="label"
          onNodeClick={handleNodeClick}
          linkColor={() => "#666"}
          linkDirectionalParticles={2}
          linkDirectionalParticleSpeed={0.005}
          nodeAutoColorBy="type"
          nodeThreeObject={(node) => {
            const sprite = new SpriteText(node.label || "");
            sprite.borderRadius = 1;
            sprite.backgroundColor = node.color + "CC";
            sprite.padding = 1;
            sprite.color = "#fff";
            sprite.textHeight = 2;
            return sprite;
          }}
          onEngineStop={handleEngineStop}
        />
      )}

      {/* Mode VR */}
      {viewMode === "VR" && (
        <GraphVR
          graphData={graphData}
          onNodeClick={handleNodeClick}
          onBack={goBack}
          onForward={goForward}
          selectedTriple={selectedTriple}
        />
      )}

      {/* Graph legend */}
      <GraphLegend showCreators={showCreators} />

      {/* Barre latérale de détails */}
      <NodeDetailsSidebar
        triple={selectedTriple}
        onClose={() => setSelectedTriple(null)}
      />
    </div>
  );
};

export default GraphVisualization;
