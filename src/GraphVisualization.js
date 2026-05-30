import React, { useEffect, useState, useCallback, useRef } from "react";
import * as d3 from "d3-force";
import { ForceGraph2D, ForceGraph3D } from "react-force-graph";
import SpriteText from "three-spritetext";
import { fetchTriples, fetchTriplesForNode, searchTriples, createClient } from "./api";
import { GetTriplesWithPositionsDocument } from "./vendor/intuition-graphql/dist/index.mjs";
import { transformToGraphData } from "./graphData";
import {
  computeClusters,
  layoutAnchors,
  makeClusterForce,
} from "./clustering";
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

// Build the contextual tooltip content for a hovered node, varying by its role
// in the triple(s) it participates in:
//   subject   -> just the subject label
//   predicate -> subject -> predicate
//   object    -> subject -> predicate -> object (its full connection)
// A node can hold several roles across triples; we prefer the most informative
// (object > predicate > subject) and show up to a couple of distinct triples.
const buildHoverContext = (node) => {
  if (!node) return null;
  const roles = node.roles instanceof Set ? node.roles : new Set([node.role]);
  const triples = node.triples || [];
  const fmt = (t) => {
    const s = truncate(t.subject?.label, 28);
    const p = truncate(t.predicate?.label, 28);
    const o = truncate(t.object?.label, 28);
    if (roles.has("object") && node.id === t.object?.id) {
      return { kind: "object", text: `${s}  →  ${p}  →  ${o}` };
    }
    if (roles.has("predicate") && node.id === t.predicate?.id) {
      return { kind: "predicate", text: `${s}  →  ${p}` };
    }
    return { kind: "subject", text: s };
  };

  // Choose lines that describe THIS node's strongest role first.
  const priority = { object: 3, predicate: 2, subject: 1 };
  const lines = [];
  const seen = new Set();
  triples
    .map(fmt)
    .sort((a, b) => priority[b.kind] - priority[a.kind])
    .forEach((l) => {
      if (seen.has(l.text)) return;
      seen.add(l.text);
      if (lines.length < 3) lines.push(l);
    });

  if (lines.length === 0) {
    return { title: truncate(node.label, 28), lines: [], role: node.role };
  }
  const role = lines[0].kind;
  return {
    title: truncate(node.label, 28),
    role,
    lines: lines.map((l) => l.text),
  };
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

  // Clustering + semantic zoom (level-of-detail) state.
  const [clusterMode, setClusterMode] = useState("none"); // none | predicate | subject
  const zoomRef = useRef(1); // live zoom k from onZoom, read inside nodeCanvasObject
  const [tooltip, setTooltip] = useState(null); // { x, y, ctx }
  const clusterRef = useRef({ anchors: new Map(), clusterKeyOf: () => null });
  const didInitialFitRef = useRef(false);

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

    if (clusterMode === "none") {
      // Default spread layout: stronger charge, longer links, collision.
      clusterRef.current = { anchors: new Map(), clusterKeyOf: () => null };
      graphData.nodes.forEach((n) => {
        n.isAnchor = false;
        // Release any pins the cluster layout may have set.
        if (!n.__userPinned) {
          n.fx = undefined;
          n.fy = undefined;
        }
      });
      const charge = -(120 + Math.min(nodeCount, 400) * 1.2);
      fg.d3Force("charge")?.strength(charge);
      fg.d3Force("link")?.distance(60).strength(0.4);
      fg.d3Force("cluster", null);
      fg.d3Force(
        "collide",
        d3.forceCollide((n) => 8 + (n.val || 1) * 2.2).strength(0.9)
      );
    } else {
      // Clustered layout: pull members toward their predicate/subject anchor.
      const { anchors, clusterKeyOf } = computeClusters(
        graphData.nodes,
        clusterMode
      );
      layoutAnchors(anchors, { pin: false });
      clusterRef.current = { anchors, clusterKeyOf };

      // Weaker global repulsion so the cluster force dominates; shorter,
      // weaker links so cross-cluster links don't fight the centroid pull.
      fg.d3Force("charge")?.strength(-60);
      fg.d3Force("link")?.distance(34).strength(0.05);
      fg.d3Force("cluster", makeClusterForce(anchors, clusterKeyOf, 0.16));
      fg.d3Force(
        "collide",
        d3.forceCollide((n) => 6 + (n.val || 1) * 1.8).strength(0.85)
      );
    }

    if (viewMode === "2D") fg.d3ReheatSimulation?.();
  }, [graphData, viewMode, clusterMode]);

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
    // First time the simulation settles: frame the whole graph generously and
    // then pull WAY back so it reads as a sparse "universe" of cluster anchors.
    if (!didInitialFitRef.current && fgRef.current && viewMode === "2D") {
      didInitialFitRef.current = true;
      const fg = fgRef.current;
      try {
        fg.zoomToFit(400, 120);
        // Then pull back so it reads as a sparse "universe". When clustering is
        // on we can zoom out harder (anchors stay labelled); in plain mode keep
        // a bit more so the graph doesn't vanish into emptiness.
        setTimeout(() => {
          try {
            const k = fg.zoom();
            const factor = clusterMode === "none" ? 0.6 : 0.4;
            fg.zoom(Math.max(k * factor, 0.1), 600);
          } catch (e) {
            /* noop */
          }
        }, 450);
      } catch (e) {
        /* noop */
      }
    }
  }, [isInitialLoad, viewMode, clusterMode]);

  // Track live zoom level for level-of-detail rendering.
  const handleZoom = useCallback((t) => {
    if (t && typeof t.k === "number") zoomRef.current = t.k;
  }, []);

  // Reset the one-time auto-fit whenever the underlying dataset changes, so a
  // newly loaded graph re-frames as a universe again.
  useEffect(() => {
    didInitialFitRef.current = false;
  }, [graphData, clusterMode]);

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

  // Contextual hover: build a role-aware tooltip and keep node-hover highlight.
  const lastMouse = useRef({ x: 0, y: 0 });
  const handleNodeHover = useCallback((node) => {
    setHoverNode(node || null);
    if (!node) {
      setTooltip(null);
      return;
    }
    const ctx = buildHoverContext(node);
    setTooltip({ ...lastMouse.current, ctx });
  }, []);

  const handleContainerMouseMove = useCallback((e) => {
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setTooltip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t));
  }, []);

  // Click a cluster anchor -> zoom/center into that cluster.
  const handleNodeClickWithCluster = useCallback(
    (node) => {
      if (node?.isAnchor && fgRef.current && viewMode === "2D") {
        try {
          fgRef.current.centerAt(node.x, node.y, 600);
          fgRef.current.zoom(Math.max(zoomRef.current, 2.2), 600);
        } catch (e) {
          /* noop */
        }
        setSelectedTriple(node);
        return;
      }
      handleNodeClick(node);
    },
    [handleNodeClick, viewMode]
  );

  return (
    <div onMouseMove={handleContainerMouseMove}>
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

      {/* Cluster-by segmented control (2D only) */}
      {viewMode === "2D" && (
        <div className="cluster-control">
          <span className="cluster-control-label">Cluster by</span>
          <div className="cluster-seg">
            {[
              { key: "none", label: "None" },
              { key: "predicate", label: "Predicate" },
              { key: "subject", label: "Subject" },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={`cluster-seg-btn${
                  clusterMode === opt.key ? " active" : ""
                }`}
                onClick={() => setClusterMode(opt.key)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Contextual hover tooltip (role-aware) */}
      {tooltip?.ctx && (
        <div
          className="graph-tooltip"
          style={{
            left: Math.min(tooltip.x + 14, window.innerWidth - 280),
            top: tooltip.y + 14,
          }}
        >
          <div className={`graph-tooltip-role role-${tooltip.ctx.role}`}>
            {tooltip.ctx.role}
          </div>
          <div className="graph-tooltip-title">{tooltip.ctx.title}</div>
          {tooltip.ctx.lines.map((line, i) => (
            <div key={i} className="graph-tooltip-line">
              {line}
            </div>
          ))}
        </div>
      )}

      {viewMode === "2D" && (
        <ForceGraph2D
          ref={(el) => (fgRef.current = el)}
          graphData={graphData}
          cooldownTicks={160}
          warmupTicks={20}
          enableNodeDrag={true}
          onZoom={handleZoom}
          onNodeHover={handleNodeHover}
          onNodeDragEnd={(node) => {
            // Pin a dragged node where the user left it.
            node.fx = node.x;
            node.fy = node.y;
            node.__userPinned = true;
          }}
          nodeCanvasObject={(node, ctx, globalScale) => {
            // Semantic zoom (level-of-detail). Three bands:
            //   k < 0.6  -> "universe": only cluster anchors + their labels
            //   0.6..2.2 -> "galaxy": member nodes fade/appear
            //   k > 2.2  -> "solar system": individual member labels appear
            const k = globalScale;
            const clustering = clusterMode !== "none";
            const isAnchor = clustering && node.isAnchor;

            const trust = node.trust;
            const hasTrust = typeof trust === "number";
            const isFocused =
              hoverNode?.id === node.id || selectedTriple?.id === node.id;

            // Member-node visibility ramps in as we zoom from universe->galaxy.
            // Anchors are always fully visible. Without clustering, everything
            // behaves like a member (so plain mode still gets LOD labels).
            let memberAlpha = 1;
            if (!isAnchor) {
              if (k < 0.6) memberAlpha = clustering ? 0 : 0.25;
              else if (k < 1.1) memberAlpha = (k - 0.6) / 0.5;
              else memberAlpha = 1;
            }
            if (isFocused) memberAlpha = 1;
            if (memberAlpha <= 0.02) {
              node.__bckgDimensions = [2, 2];
              return;
            }

            // Radius: anchors big and zoom-stable; members scale with trust.
            const baseR = isAnchor
              ? 6 + Math.min((node.triples?.length || 1) * 0.35, 8)
              : 3 + (hasTrust ? trust * 6 : 1.5);
            const dotRadius = baseR / k;

            const a255 = Math.round(memberAlpha * 255)
              .toString(16)
              .padStart(2, "0");
            const trustHex = hasTrust
              ? Math.round((0.45 + trust * 0.55) * memberAlpha * 255)
                  .toString(16)
                  .padStart(2, "0")
              : a255;

            // Anchor halo so cluster centers read as "suns".
            if (isAnchor) {
              const halo = (baseR * 2.4) / k;
              const grad = ctx.createRadialGradient(
                node.x,
                node.y,
                dotRadius,
                node.x,
                node.y,
                halo
              );
              grad.addColorStop(0, node.color + "55");
              grad.addColorStop(1, node.color + "00");
              ctx.beginPath();
              ctx.arc(node.x, node.y, halo, 0, 2 * Math.PI);
              ctx.fillStyle = grad;
              ctx.fill();
            }

            ctx.beginPath();
            ctx.arc(node.x, node.y, dotRadius, 0, 2 * Math.PI);
            ctx.fillStyle = node.color + (isAnchor ? "FF" : trustHex);
            ctx.fill();

            // Trust glow ring + focus highlight.
            if (isFocused) {
              ctx.lineWidth = 2 / k;
              ctx.strokeStyle = "#fff";
              ctx.stroke();
            } else if (hasTrust && trust > 0) {
              ctx.lineWidth = (0.5 + trust * 1.5) / k;
              ctx.strokeStyle = `rgba(255,255,255,${
                (0.2 + trust * 0.6) * memberAlpha
              })`;
              ctx.stroke();
            } else if (isAnchor) {
              ctx.lineWidth = 1.5 / k;
              ctx.strokeStyle = "rgba(255,255,255,0.85)";
              ctx.stroke();
            }

            // ---- Labels (LOD) ----
            // Anchors: persistent prominent labels at every zoom level.
            // Members: labels appear when zoomed in (solar system), on focus,
            // or for notably-trusted nodes.
            const showMemberLabel =
              isFocused || k > 2.2 || (hasTrust && trust > 0.4);
            const showLabel = isAnchor || showMemberLabel;
            if (!showLabel) {
              node.__bckgDimensions = [dotRadius * 2, dotRadius * 2];
              return;
            }

            const label = truncate(node.label, isAnchor ? 26 : 22);
            const fontPx = isAnchor
              ? Math.max(13, isFocused ? 14 : 12)
              : isFocused
              ? 12
              : 10;
            const fontSize = fontPx / k;
            ctx.font = `${isAnchor ? "600 " : ""}${fontSize}px Sans-Serif`;
            const textWidth = ctx.measureText(label).width;
            const padding = (isAnchor ? 5 : 4) / k;
            const labelY = node.y + dotRadius + fontSize / 2 + padding;

            ctx.globalAlpha = isAnchor ? 1 : memberAlpha;
            ctx.fillStyle = isAnchor
              ? "rgba(0,0,0,0.78)"
              : "rgba(0,0,0,0.6)";
            ctx.fillRect(
              node.x - textWidth / 2 - padding,
              labelY - fontSize / 2 - padding / 2,
              textWidth + padding * 2,
              fontSize + padding
            );
            if (isAnchor) {
              ctx.lineWidth = 1 / k;
              ctx.strokeStyle = node.color + "AA";
              ctx.strokeRect(
                node.x - textWidth / 2 - padding,
                labelY - fontSize / 2 - padding / 2,
                textWidth + padding * 2,
                fontSize + padding
              );
            }

            ctx.fillStyle = isAnchor ? "#fff" : "#eee";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, node.x, labelY);
            ctx.globalAlpha = 1;

            node.__bckgDimensions = [dotRadius * 2, dotRadius * 2];
          }}
          nodePointerAreaPaint={(node, color, ctx) => {
            ctx.fillStyle = color;
            const r = (node.__bckgDimensions?.[0] || 6) / 2;
            ctx.beginPath();
            ctx.arc(node.x, node.y, Math.max(r, 4), 0, 2 * Math.PI);
            ctx.fill();
          }}
          linkColor={(l) => {
            if (typeof l.trust === "number")
              return `rgba(120,170,255,${0.25 + l.trust * 0.65})`;
            // Dim inter-cluster clutter at low zoom so the universe stays sparse.
            return clusterMode !== "none" && zoomRef.current < 1.1
              ? "rgba(120,130,160,0.18)"
              : "#666";
          }}
          linkWidth={(l) => (typeof l.trust === "number" ? 1 + l.trust * 4 : 1)}
          linkDirectionalParticles={(l) =>
            zoomRef.current > 1.4 || typeof l.trust === "number" ? 1 : 0
          }
          linkDirectionalParticleSpeed={0.02}
          linkDirectionalParticleColor={() => "#fff"}
          nodeAutoColorBy="type"
          onNodeClick={handleNodeClickWithCluster}
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
