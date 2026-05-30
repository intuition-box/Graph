import React, { useEffect, useState, useCallback, useRef } from "react";
import * as d3 from "d3-force";
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

// Parse a share string to a finite number (shares are huge, but relative
// magnitude is all we need for visual weighting).
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Truncate long labels so they don't overflow into neighbouring nodes.
const truncate = (s, max = 22) => {
  const str = String(s || "");
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
};

// Map a raw GetTriplesWithPositions triple into the {subject,predicate,object}
// shape that transformToGraphData expects.
const toTriple = (t) => ({
  id: t.term_id,
  subject: t.subject
    ? { id: t.subject.term_id, label: t.subject.label }
    : { id: String(t.subject_id || t.term_id), label: String(t.subject_id || t.term_id) },
  predicate: t.predicate
    ? { id: t.predicate.term_id, label: t.predicate.label }
    : { id: String(t.predicate_id || t.term_id), label: String(t.predicate_id || t.term_id) },
  object: t.object
    ? { id: t.object.term_id, label: t.object.label }
    : { id: String(t.object_id || t.term_id), label: String(t.object_id || t.term_id) },
});

// Annotate nodes/links with a normalized trust signal (0..1) derived from the
// summed trust-circle shares on each triple touching the node. Sets `node.trust`
// (for sizing), `node.val` (force-graph node size) and `link.trust`.
const applyTrustWeights = (graph, triples, tripleWeights) => {
  const nodeWeight = new Map();
  triples.forEach((tr) => {
    const w = tripleWeights[tr.id] || 0;
    [tr.subject, tr.predicate, tr.object].forEach((e) => {
      if (!e) return;
      nodeWeight.set(e.id, (nodeWeight.get(e.id) || 0) + w);
    });
  });
  const max = Math.max(1, ...Array.from(nodeWeight.values()));
  graph.nodes.forEach((n) => {
    const raw = nodeWeight.get(n.id) || 0;
    const trust = max > 0 ? raw / max : 0;
    n.trust = trust;
    n.val = 1 + trust * 8;
  });
  const nodeTrust = (id) => nodeWeight.get(id) || 0;
  graph.links.forEach((l) => {
    const s = typeof l.source === "object" ? l.source.id : l.source;
    const t = typeof l.target === "object" ? l.target.id : l.target;
    l.trust = max > 0 ? Math.max(nodeTrust(s), nodeTrust(t)) / max : 0;
  });
  return graph;
};

const GraphVisualization = ({ endpoint, userFilterAddress, trustCircle }) => {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [initialGraphData, setInitialGraphData] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [viewMode, setViewMode] = useState("2D");
  const [hoverNode, setHoverNode] = useState(null);
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

  // Spread nodes out so the graph stops rendering as an overlapping blob:
  // stronger charge repulsion, longer links, and a collision force keyed to node
  // size. Re-applied whenever the data or view mode changes (the force-graph
  // rebuilds its simulation on those transitions).
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || viewMode === "VR" || typeof fg.d3Force !== "function") return;
    const nodeCount = graphData.nodes.length || 1;
    // Scale repulsion with size: denser graphs need a bit more push.
    const charge = -(120 + Math.min(nodeCount, 400) * 1.2);
    fg.d3Force("charge")?.strength(charge);
    fg.d3Force("link")?.distance(60).strength(0.4);
    fg.d3Force(
      "collide",
      d3.forceCollide((n) => 8 + (n.val || 1) * 2.2).strength(0.9)
    );
    if (viewMode === "2D") fg.d3ReheatSimulation?.();
  }, [graphData, viewMode]);

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

  // Focus graph on user's positions when a single filter address is provided
  // (Reality Tunnel "Single perspective" mode).
  useEffect(() => {
    const run = async () => {
      if (!userFilterAddress) {
        // restore initial graph (unless an aggregate trust-circle is active)
        if (!trustCircle && initialGraphData) setGraphData(initialGraphData);
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
        const userSide = (side) => {
          const vaults = side?.vaults || [];
          let shares = 0;
          let has = false;
          vaults.forEach((v) => {
            (v.positions || []).forEach((p) => {
              if (String(p?.account?.id || '').toLowerCase() === addrLc) {
                has = true;
                shares += toNum(p?.shares);
              }
            });
          });
          return { has, shares };
        };
        const enriched = raw
          .map((t) => {
            const a = userSide(t.term);
            const b = userSide(t.counter_term);
            return { t, has: a.has || b.has, w: a.shares + b.shares };
          })
          .filter((x) => x.has);
        const triples = enriched.map(({ t }) => toTriple(t));
        const tripleWeights = {};
        enriched.forEach(({ t, w }) => { tripleWeights[t.term_id] = w; });

        let userGraph = transformToGraphData(triples);
        if (showCreators) {
          userGraph = enhanceGraphDataWithCreators(userGraph, triples);
        }
        applyTrustWeights(userGraph, triples, tripleWeights);
        setGraphData(userGraph);
      } catch (e) {
        console.error("Error focusing on user positions:", e);
      } finally {
        setIsLoading(false);
      }
    };
    run();
  }, [userFilterAddress, endpoint, showCreators, enhanceGraphDataWithCreators, initialGraphData, trustCircle]);

  // Aggregate the graph across the whole trust circle (Reality Tunnel "My
  // circle" / "All circle" modes). Filters triples to those any trusted account
  // holds a position on, and weights nodes by summed trust-circle shares.
  useEffect(() => {
    const run = async () => {
      const addresses = trustCircle?.addresses || [];
      if (!trustCircle || addresses.length === 0) {
        if (!userFilterAddress && initialGraphData) setGraphData(initialGraphData);
        return;
      }
      setIsLoading(true);
      try {
        const client = createClient(endpoint);
        const addrSet = new Set(addresses.map((a) => String(a).toLowerCase()));
        const where = {
          term: { vaults: { positions: { account_id: { _in: addresses } } } },
        };
        const data = await client.request(GetTriplesWithPositionsDocument, {
          where,
          address: "%",
          limit: 1000,
        });
        const raw = data?.triples || [];
        const circleShares = (side) => {
          const vaults = side?.vaults || [];
          let total = 0;
          vaults.forEach((v) => {
            (v.positions || []).forEach((p) => {
              if (addrSet.has(String(p?.account?.id || '').toLowerCase())) {
                total += toNum(p?.shares);
              }
            });
          });
          return total;
        };
        const enriched = raw.map((t) => ({
          t,
          w: circleShares(t.term) + circleShares(t.counter_term),
        }));
        const triples = enriched.map(({ t }) => toTriple(t));
        const tripleWeights = {};
        enriched.forEach(({ t, w }) => { tripleWeights[t.term_id] = w; });

        let circleGraph = transformToGraphData(triples);
        if (showCreators) {
          circleGraph = enhanceGraphDataWithCreators(circleGraph, triples);
        }
        applyTrustWeights(circleGraph, triples, tripleWeights);
        setGraphData(circleGraph);
      } catch (e) {
        console.error("Error building trust-circle graph:", e);
      } finally {
        setIsLoading(false);
      }
    };
    run();
  }, [trustCircle, userFilterAddress, endpoint, showCreators, enhanceGraphDataWithCreators, initialGraphData]);

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
          cooldownTicks={120}
          warmupTicks={20}
          onNodeHover={setHoverNode}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const trust = node.trust;
            const hasTrust = typeof trust === "number";
            const dotRadius = (3 + (hasTrust ? trust * 6 : 1.5)) / globalScale;

            // Opacity scales with trust signal so strongly-staked nodes pop.
            const alpha = hasTrust
              ? Math.round((0.45 + trust * 0.55) * 255)
                  .toString(16)
                  .padStart(2, "0")
              : "CC";

            // Always draw a compact node dot (cheap, never overlaps text).
            ctx.beginPath();
            ctx.arc(node.x, node.y, dotRadius, 0, 2 * Math.PI);
            ctx.fillStyle = node.color + alpha;
            ctx.fill();

            // Trust glow: brighter ring for higher-trust nodes.
            if (hasTrust && trust > 0) {
              ctx.lineWidth = (0.5 + trust * 1.5) / globalScale;
              ctx.strokeStyle = `rgba(255,255,255,${0.2 + trust * 0.6})`;
              ctx.stroke();
            }

            // Only render the text label when it won't create a hairball:
            // on hover/selection, when zoomed in, or for notably-trusted nodes.
            const isFocused =
              hoverNode?.id === node.id || selectedTriple?.id === node.id;
            const showLabel =
              isFocused || globalScale > 1.6 || (hasTrust && trust > 0.35);
            if (!showLabel) {
              node.__bckgDimensions = [dotRadius * 2, dotRadius * 2];
              return;
            }

            const label = truncate(node.label);
            const fontSize = (isFocused ? 11 : 9) / globalScale;
            ctx.font = `${fontSize}px Sans-Serif`;
            const textWidth = ctx.measureText(label).width;
            const padding = 4 / globalScale;
            const labelY = node.y + dotRadius + fontSize / 2 + padding;

            // Subtle backing pill so labels stay readable over links.
            ctx.fillStyle = "rgba(0,0,0,0.6)";
            ctx.fillRect(
              node.x - textWidth / 2 - padding,
              labelY - fontSize / 2 - padding / 2,
              textWidth + padding * 2,
              fontSize + padding
            );

            ctx.fillStyle = "#fff";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, node.x, labelY);

            node.__bckgDimensions = [dotRadius * 2, dotRadius * 2];
          }}
          nodePointerAreaPaint={(node, color, ctx) => {
            ctx.fillStyle = color;
            const r = (node.__bckgDimensions?.[0] || 6) / 2;
            ctx.beginPath();
            ctx.arc(node.x, node.y, Math.max(r, 4), 0, 2 * Math.PI);
            ctx.fill();
          }}
          linkColor={(l) =>
            typeof l.trust === "number"
              ? `rgba(120,170,255,${0.25 + l.trust * 0.65})`
              : "#666"
          }
          linkWidth={(l) => (typeof l.trust === "number" ? 1 + l.trust * 4 : 1)}
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
          linkColor={(l) =>
            typeof l.trust === "number"
              ? `rgba(120,170,255,${0.25 + l.trust * 0.65})`
              : "#666"
          }
          linkWidth={(l) => (typeof l.trust === "number" ? 0.5 + l.trust * 3 : 0)}
          linkDirectionalParticles={2}
          linkDirectionalParticleSpeed={0.005}
          nodeAutoColorBy="type"
          nodeRelSize={4}
          nodeThreeObject={(node) => {
            const trust = node.trust;
            const hasTrust = typeof trust === "number";
            // Only label notably-trusted nodes to avoid a wall of text. Global
            // view (no trust signal) shows no sprite labels — nodes keep their
            // colored sphere + hover tooltip (nodeLabel="label").
            const labelled = hasTrust && trust > 0.35;
            if (!labelled) return false;
            const sprite = new SpriteText(truncate(node.label, 18));
            sprite.borderRadius = 1;
            const alpha = hasTrust
              ? Math.round((0.45 + trust * 0.55) * 255)
                  .toString(16)
                  .padStart(2, "0")
              : "CC";
            sprite.backgroundColor = node.color + alpha;
            sprite.padding = 1;
            sprite.color = "#fff";
            sprite.textHeight = hasTrust ? 3 + trust * 4 : 3;
            return sprite;
          }}
          nodeThreeObjectExtend={true}
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
