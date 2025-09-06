import React, { useEffect, useState, useCallback, useRef } from "react";
import { ForceGraph2D, ForceGraph3D } from "react-force-graph";
import SpriteText from "three-spritetext";
import { fetchTriples, fetchTriplesForNode, searchTriples, createClient } from "./api";
import { GetTriplesWithPositionsDocument } from "./vendor/intuition-graphql/dist/index.mjs";
import { transformToGraphData } from "./graphData";
import { NODE_COLORS } from "./nodeColors";
import GraphLegend from "./GraphLegend";
import GraphVR from "./GraphVR";
import NodeDetailsSidebar from "./NodeDetailsSidebar";
import LoadingAnimation from "./LoadingAnimation";

const GraphVisualization = ({ endpoint, userFilterAddress }) => {
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
  const searchTimeoutRef = useRef(null);

  // Filtres
  const [subjectFilter, setSubjectFilter] = useState("");
  const [predicateFilter, setPredicateFilter] = useState("");
  const [objectFilter, setObjectFilter] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [shouldSearch, setShouldSearch] = useState(false);

  const enhanceGraphDataWithCreators = useCallback((graphData, triples) => {
    const creatorNodes = [];
    const creatorLinks = [];

    triples.forEach((triple) => {
      const entities = [triple.subject, triple.predicate, triple.object];

      entities.forEach((entity) => {
        if (entity.creator_id) {
          if (
            !creatorNodes.find(
              (node) => node.id === `creator-${entity.creator_id}`
            )
          ) {
            creatorNodes.push({
              id: `creator-${entity.creator_id}`,
              label: `${entity.creator_id}`,
              type: "creator",
              color: NODE_COLORS.CREATOR,
            });
          }

          creatorLinks.push({
            source: `creator-${entity.creator_id}`,
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
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const triples = await fetchTriples(endpoint);
        let baseGraphData = transformToGraphData(triples);

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
  }, [showCreators, endpoint, enhanceGraphDataWithCreators]);

  // Focus graph on user's positions when a filter address is provided
  useEffect(() => {
    const run = async () => {
      if (!userFilterAddress) {
        // restore initial graph
        if (initialGraphData) setGraphData(initialGraphData);
        return;
      }
      setIsLoading(true);
      try {
        const client = createClient(endpoint);
        const where = {
          _or: [
            { term: { vaults: { positions: { account_id: { _ilike: userFilterAddress } } } } },
            { counter_term: { vaults: { positions: { account_id: { _ilike: userFilterAddress } } } } },
          ],
        };
        const data = await client.request(GetTriplesWithPositionsDocument, {
          where,
          address: userFilterAddress,
          limit: 1000,
        });
        const raw = data?.triples || [];
        const addrLc = String(userFilterAddress).toLowerCase();
        const hasUserPos = (side) => {
          const vaults = side?.vaults || [];
          return vaults.some((v) =>
            (v.positions || []).some((p) =>
              String(p?.account?.id || '').toLowerCase() === addrLc
            )
          );
        };
        const onlyUser = raw.filter((t) => hasUserPos(t.term) || hasUserPos(t.counter_term));
        const triples = onlyUser.map((t) => ({
          id: t.term_id,
          subject: t.subject
            ? { id: t.subject.term_id, label: t.subject.label }
            : { id: String(t.subject_id || t.term_id) , label: String(t.subject_id || t.term_id) },
          predicate: t.predicate
            ? { id: t.predicate.term_id, label: t.predicate.label }
            : { id: String(t.predicate_id || t.term_id), label: String(t.predicate_id || t.term_id) },
          object: t.object
            ? { id: t.object.term_id, label: t.object.label }
            : { id: String(t.object_id || t.term_id), label: String(t.object_id || t.term_id) },
        }));

        let userGraph = transformToGraphData(triples);
        if (showCreators) {
          userGraph = enhanceGraphDataWithCreators(userGraph, triples);
        }
        setGraphData(userGraph);
      } catch (e) {
        console.error("Error focusing on user positions:", e);
      } finally {
        setIsLoading(false);
      }
    };
    run();
  }, [userFilterAddress, endpoint, showCreators, enhanceGraphDataWithCreators, initialGraphData]);

  const resetGraph = useCallback(() => {
    setGraphData(initialGraphData);
    setSelectedTriple(null);
    setSubjectFilter("");
    setPredicateFilter("");
    setObjectFilter("");
    setShouldSearch(false);
  }, [initialGraphData]);

  const handleNodeClick = useCallback(
    async (node) => {
      console.log("Node clicked:", node);
      setSelectedTriple(node);

      if (fgRef.current) {
        try {
          const nodePosition = {
            x: node.x,
            y: node.y,
            z: node.z || 0,
          };

          const filteredTriples = await fetchTriplesForNode(node.id, endpoint);
          const newGraphData = transformToGraphData(filteredTriples);

          const targetNode = newGraphData.nodes.find((n) => n.id === node.id);
          if (targetNode) {
            targetNode.x = nodePosition.x;
            targetNode.y = nodePosition.y;
            if (viewMode === "3D") targetNode.z = nodePosition.z;

            targetNode.fx = nodePosition.x;
            targetNode.fy = nodePosition.y;
            if (viewMode === "3D") targetNode.fz = nodePosition.z;
          }

          setGraphHistory((prevHistory) => {
            const updatedHistory = prevHistory.slice(
              0,
              currentHistoryIndex + 1
            );
            updatedHistory.push({ graphData, selectedTriple: node });
            return updatedHistory;
          });
          setCurrentHistoryIndex((prevIndex) => prevIndex + 1);

          setGraphData(newGraphData);
        } catch (error) {
          console.error("Error fetching triples:", error);
        }
      }
    },
    [viewMode, graphData, currentHistoryIndex, endpoint]
  );

  const handleEngineStop = useCallback(() => {
    if (isInitialLoad && fgRef.current) {
      setIsInitialLoad(false);
    }
  }, [isInitialLoad]);

  const goBack = useCallback(() => {
    if (currentHistoryIndex > 0) {
      const { graphData, selectedTriple } =
        graphHistory[currentHistoryIndex - 1];
      setGraphData(graphData);
      setSelectedTriple(selectedTriple);
      setCurrentHistoryIndex((prevIndex) => prevIndex - 1);
    }
  }, [currentHistoryIndex, graphHistory]);

  const goForward = useCallback(() => {
    if (currentHistoryIndex < graphHistory.length - 1) {
      const { graphData, selectedTriple } =
        graphHistory[currentHistoryIndex + 1];
      setGraphData(graphData);
      setSelectedTriple(selectedTriple);
      setCurrentHistoryIndex((prevIndex) => prevIndex + 1);
    }
  }, [currentHistoryIndex, graphHistory]);

  const applyFilters = useCallback(async () => {
    if (!shouldSearch) return;

    console.log("Applying filters:", {
      subjectFilter,
      predicateFilter,
      objectFilter,
    });

    if (!subjectFilter && !predicateFilter && !objectFilter) {
      resetGraph();
      return;
    }

    setIsSearching(true);
    try {
      const filters = {
        subject: subjectFilter,
        predicate: predicateFilter,
        object: objectFilter,
      };

      console.log("Sending search request with filters:", filters);
      const searchResults = await searchTriples(filters, endpoint);
      console.log("Search results:", searchResults);

      if (!searchResults || searchResults.length === 0) {
        console.log("No results found");
        setGraphData({ nodes: [], links: [] });
        return;
      }

      const newGraphData = transformToGraphData(searchResults);
      console.log("Transformed graph data:", newGraphData);

      if (showCreators) {
        const enhancedData = enhanceGraphDataWithCreators(
          newGraphData,
          searchResults
        );
        console.log("Enhanced graph data with creators:", enhancedData);
        setGraphData(enhancedData);
      } else {
        setGraphData(newGraphData);
      }

      setGraphHistory((prevHistory) => {
        const updatedHistory = prevHistory.slice(0, currentHistoryIndex + 1);
        updatedHistory.push({ graphData: newGraphData, selectedTriple: null });
        return updatedHistory;
      });
      setCurrentHistoryIndex((prevIndex) => prevIndex + 1);
    } catch (error) {
      console.error("Error searching triples:", error);
    } finally {
      setIsSearching(false);
      setShouldSearch(false);
    }
  }, [
    subjectFilter,
    predicateFilter,
    objectFilter,
    endpoint,
    showCreators,
    enhanceGraphDataWithCreators,
    resetGraph,
    currentHistoryIndex,
    shouldSearch,
  ]);

  // Handle search input changes
  const handleSearchInput = useCallback((type, value) => {
    console.log(`Search input changed - type: ${type}, value: ${value}`);

    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Update the appropriate filter
    switch (type) {
      case "subject":
        setSubjectFilter(value);
        break;
      case "predicate":
        setPredicateFilter(value);
        break;
      case "object":
        setObjectFilter(value);
        break;
      default:
        break;
    }

    // Set a new timeout
    searchTimeoutRef.current = setTimeout(() => {
      setShouldSearch(true);
    }, 500);
  }, []);

  // Effect for handling search
  useEffect(() => {
    if (shouldSearch) {
      applyFilters();
    }
  }, [shouldSearch, applyFilters]);

  return (
    <div>
      {(isLoading || isSearching) && <LoadingAnimation />}
      <button
        className="navigation-button"
        onClick={resetGraph}
        style={{
          position: "absolute",
          top: "75px",
          left: "10px",
          zIndex: 50,
          width: "143px",
        }}
      >
        Return to initial graph
      </button>

      <button
        className="navigation-button"
        onClick={goBack}
        style={{
          position: "absolute",
          top: "110px",
          left: "10px",
          width: "70px",
          zIndex: 50,
        }}
        disabled={currentHistoryIndex <= 0}
      >
        Previous
      </button>
      <button
        className="navigation-button"
        onClick={goForward}
        style={{
          position: "absolute",
          top: "110px",
          left: "83px",
          width: "70px",
          zIndex: 50,
        }}
        disabled={currentHistoryIndex >= graphHistory.length - 1}
      >
        Next
      </button>

      <div
        style={{
          position: "absolute",
          top: "82px",
          right: "10px",
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          gap: "10px",
          background: "#444",
          color: "#fff",
          padding: "10px",
          borderRadius: "4px",
        }}
      >
        <label htmlFor="viewMode" style={{ fontSize: "14px" }}>
          View Mode:
        </label>
        <select
          id="viewMode"
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value)}
          style={{
            padding: "5px",
            borderRadius: "4px",
            border: "none",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          <option value="2D">2D</option>
          <option value="3D">3D</option>
          <option value="VR">VR</option>
        </select>

        <label style={{ fontSize: "14px", marginLeft: "10px" }}>
          Show Creators
          <input
            type="checkbox"
            checked={showCreators}
            onChange={(e) => setShowCreators(e.target.checked)}
            style={{ marginLeft: "8px" }}
          />
        </label>
        {/* Filtres alignés horizontalement sous l'endpoint */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <input
            type="text"
            value={subjectFilter}
            onChange={(e) => handleSearchInput("subject", e.target.value)}
            placeholder="Subject"
            style={{
              padding: "5px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              fontSize: "14px",
              width: "100px",
            }}
          />
          <input
            type="text"
            value={predicateFilter}
            onChange={(e) => handleSearchInput("predicate", e.target.value)}
            placeholder="Predicate"
            style={{
              padding: "5px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              fontSize: "14px",
              width: "100px",
            }}
          />
          <input
            type="text"
            value={objectFilter}
            onChange={(e) => handleSearchInput("object", e.target.value)}
            placeholder="Object"
            style={{
              padding: "5px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              fontSize: "14px",
              width: "100px",
            }}
          />
        </div>
      </div>

      {viewMode === "2D" && (
        <ForceGraph2D
          ref={(el) => (fgRef.current = el)}
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
          linkColor={() => "#666"}
          linkDirectionalParticles={1}
          linkDirectionalParticleSpeed={0.02}
          linkDirectionalParticleColor={() => "#fff"}
          nodeAutoColorBy="type"
          onNodeClick={handleNodeClick}
          onEngineStop={handleEngineStop}
        />
      )}

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

      {viewMode === "VR" && (
        <GraphVR
          graphData={graphData}
          onNodeClick={handleNodeClick}
          onBack={goBack}
          onForward={goForward}
          selectedTriple={selectedTriple}
        />
      )}

      <GraphLegend showCreators={showCreators} />

      {selectedTriple && (
        <NodeDetailsSidebar
          triple={selectedTriple}
          endpoint={endpoint}
          onClose={() => setSelectedTriple(null)}
        />
      )}
    </div>
  );
};

export default GraphVisualization;
