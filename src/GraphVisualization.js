import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import * as d3 from "d3-force";
import { ForceGraph2D, ForceGraph3D } from "react-force-graph";
import SpriteText from "three-spritetext";
import { fetchTriples, fetchTriplesForNode, searchTriples, ENDPOINTS } from "./api";
import { fetchTrustGraph } from "./trustCircle";
import { transformToGraphData } from "./graphData";
import {
  computeClusters,
  layoutAnchors,
  makeClusterForce,
  computeRadialLayout,
  applyRadialPositions,
} from "./clustering";
import { NODE_COLORS } from "./nodeColors";
import ControlDock from "./ControlDock";
import GraphVR from "./GraphVR";
import FocusGraph from "./FocusGraph";
import NodeDetailsSidebar from "./NodeDetailsSidebar";

// Treat narrow viewports as mobile: nodes/labels get a touch-friendly size bump
// and the 3D fly-controls hint hides.
const MOBILE_BP = 768;
const isMobileViewport = () =>
  typeof window !== "undefined" && window.innerWidth <= MOBILE_BP;

// Read an initial ?mode= from the URL so the app can deep-link straight into a
// view (e.g. ?mode=focus for the Arkham-style focus explorer). Falls back to 2D.
const getInitialViewMode = () => {
  try {
    const m = (new URLSearchParams(window.location.search).get("mode") || "")
      .trim()
      .toLowerCase();
    if (m === "focus") return "focus";
    if (m === "3d") return "3D";
    if (m === "vr") return "VR";
    if (m === "2d") return "2D";
  } catch {
    /* noop */
  }
  return "2D";
};

// Render at most this many trust-mode triples (ranked by trust weight) so even
// a whale account's tunnel stays a readable graph instead of a hairball.
const MAX_TRUST_TRIPLES = 400;

const MODE_LABELS = {
  global: "Global",
  mine: "My circle",
  single: "Person",
  all: "All circle",
};

// Truncate long labels so they don't overflow into neighbouring nodes.
const truncate = (s, max = 22) => {
  const str = String(s || "");
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
};

// Build the contextual tooltip content for a hovered node. In the
// predicate-as-edge model a node is a subject or an object atom; either way we
// show the FULL triple(s) it participates in (subject -> predicate -> object),
// so hovering any node always reveals its relationships. We prefer the rows
// where this node is the OBJECT (its full inbound connection) but cap to a few.
const buildHoverContext = (node) => {
  if (!node) return null;
  const roles = node.roles instanceof Set ? node.roles : new Set([node.role]);
  const triples = node.triples || [];
  const fmt = (t) => {
    const s = truncate(t.subject?.label, 26);
    const p = truncate(t.predicate?.label, 26);
    const o = truncate(t.object?.label, 26);
    const kind = node.id === t.object?.id ? "object" : "subject";
    return { kind, text: `${s}  →  ${p}  →  ${o}` };
  };

  // Lines where this node is the object (full inbound triple) come first.
  const priority = { object: 2, subject: 1 };
  const lines = [];
  const seen = new Set();
  triples
    .map(fmt)
    .sort((a, b) => priority[b.kind] - priority[a.kind])
    .forEach((l) => {
      if (seen.has(l.text)) return;
      seen.add(l.text);
      if (lines.length < 4) lines.push(l);
    });

  const role = roles.has("subject") ? "subject" : "object";
  const title = truncate(node.label || node.id, 28) || "(unlabeled)";
  if (lines.length === 0) {
    return { title, lines: [], role };
  }
  return {
    title,
    role,
    lines: lines.map((l) => l.text),
  };
};

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

const GraphVisualization = ({
  endpoint,
  onEndpointChange,
  address,
  addressSource,
  accountLabel,
  onAddressOverride,
  tunnel,
  onTunnelChange,
}) => {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [initialGraphData, setInitialGraphData] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [viewMode, setViewMode] = useState(getInitialViewMode);
  const [hoverNode, setHoverNode] = useState(null);
  const [selectedTriple, setSelectedTriple] = useState(null);
  const [showCreators, setShowCreators] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadStages, setLoadStages] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [emptyInfo, setEmptyInfo] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isMobile, setIsMobile] = useState(isMobileViewport);
  useEffect(() => {
    const onResize = () => setIsMobile(isMobileViewport());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const fgRef = useRef();
  const [graphHistory, setGraphHistory] = useState([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);
  const searchTimeoutRef = useRef(null);

  const tunnelMode = tunnel?.mode || "global";
  // The global loader reads the live mode through a ref so switching tunnel
  // modes doesn't re-trigger the (expensive) global fetch.
  const tunnelModeRef = useRef(tunnelMode);
  tunnelModeRef.current = tunnelMode;

  // Clustering + semantic zoom (level-of-detail) state.
  // "radial" is the default: subject hubs (inner ring/center) with
  // predicate-colored EDGES fanning out to object leaves (outer ring) within
  // each subject's angular wedge — the user's primary branch vision.
  const [clusterMode, setClusterMode] = useState("radial"); // radial | none | subject
  const zoomRef = useRef(1); // live zoom k from onZoom, read inside nodeCanvasObject
  // The settled "universe" zoom (k right after auto-fit + pull-back). Because the
  // radial layout's coordinate scale grows with subject count, the absolute zoom
  // k at "fit" varies wildly; LOD thresholds are expressed as MULTIPLES of this
  // baseline so the map-zoom feel is consistent regardless of graph size.
  const universeZoomRef = useRef(0.4);
  const radialMetaRef = useRef(null); // { r1, r2, sCount } from the radial layout
  const [tooltip, setTooltip] = useState(null); // { x, y, ctx }
  const clusterRef = useRef({ anchors: new Map(), clusterKeyOf: () => null });
  const didInitialFitRef = useRef(false);

  // ---- Predicate filter (branches by relationship category) -----------------
  // Mainnet has only ~12 distinct predicates, so we list them as toggle chips
  // colored by their branch color. `enabledPredicates` = null means ALL on
  // (default); otherwise it's the Set of predicateIds currently shown.
  const [enabledPredicates, setEnabledPredicates] = useState(null);

  // Distinct predicates present in the current graph (id, label, color), sorted
  // by branch frequency so the busiest categories sit first.
  const predicateList = useMemo(() => {
    if (graphData.predicates && graphData.predicates.length) {
      const counts = new Map();
      graphData.links.forEach((l) => {
        if (l.predicateId == null) return;
        counts.set(l.predicateId, (counts.get(l.predicateId) || 0) + 1);
      });
      return [...graphData.predicates]
        .map((p) => ({ ...p, count: counts.get(p.id) || 0 }))
        .sort((a, b) => b.count - a.count);
    }
    return [];
  }, [graphData]);

  // The few biggest subject hubs (by triple count). At the lowest "universe"
  // zoom we label ONLY these — like a map showing only major city names when
  // fully zoomed out. Everything else stays an unlabeled dot until you zoom in.
  const bigHubIds = useMemo(() => {
    const subs = graphData.nodes.filter((n) => n.role === "subject");
    const ranked = [...subs].sort(
      (a, b) => (b.triples?.length || 0) - (a.triples?.length || 0)
    );
    const n = Math.min(6, Math.ceil(ranked.length * 0.04));
    return new Set(ranked.slice(0, Math.max(1, n)).map((s) => s.id));
  }, [graphData]);

  const isPredicateOn = useCallback(
    (pid) => enabledPredicates === null || enabledPredicates.has(pid),
    [enabledPredicates]
  );

  const togglePredicate = useCallback(
    (pid, isolate = false) => {
      if (isolate) {
        setEnabledPredicates(new Set([pid]));
        return;
      }
      setEnabledPredicates((prev) => {
        // First toggle off from "all on": seed with every id then remove this.
        const base =
          prev === null
            ? new Set(predicateList.map((p) => p.id))
            : new Set(prev);
        if (base.has(pid)) base.delete(pid);
        else base.add(pid);
        // If everything ended up on, collapse back to null ("all").
        if (base.size === predicateList.length) return null;
        return base;
      });
    },
    [predicateList]
  );

  const allPredicatesOn = useCallback(
    () => setEnabledPredicates(null),
    []
  );

  // The graph actually rendered: links pruned to enabled predicates, and object
  // leaves with no remaining inbound edge pruned too (so filtering visibly
  // collapses branches). Subjects always stay so the universe keeps its shape.
  const visibleGraph = useMemo(() => {
    if (enabledPredicates === null) return graphData;
    const links = graphData.links.filter((l) => enabledPredicates.has(l.predicateId));
    const keepIds = new Set();
    links.forEach((l) => {
      keepIds.add(typeof l.source === "object" ? l.source.id : l.source);
      keepIds.add(typeof l.target === "object" ? l.target.id : l.target);
    });
    const nodes = graphData.nodes.filter(
      (n) => n.role === "subject" || keepIds.has(n.id)
    );
    return { nodes, links, predicates: graphData.predicates };
  }, [graphData, enabledPredicates]);

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

    if (clusterMode === "radial") {
      // 2-level radial branch layout: subject hubs on the inner ring, each
      // subject's object leaves fanned in its own wedge at the outer ring;
      // predicate-colored edges ARE the branches. Positions are PINNED for
      // legibility; dragging a node re-pins it where dropped.
      clusterRef.current = { anchors: new Map(), clusterKeyOf: () => null };
      const radialMeta = computeRadialLayout(graphData.nodes, graphData.links);
      radialMetaRef.current = radialMeta;
      applyRadialPositions(graphData.nodes, { pin: true });

      // Forces are mostly neutralized — pins hold the tree shape. Keep a gentle
      // collision so overlapping leaves nudge apart without breaking the radii.
      fg.d3Force("charge")?.strength(-30);
      fg.d3Force("link")?.strength(0);
      fg.d3Force("cluster", null);
      fg.d3Force(
        "collide",
        d3.forceCollide((n) => 4 + (n.val || 1) * 1.4).strength(0.4)
      );
    } else if (clusterMode === "none") {
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
      // Release any radial pins first (radial mode pins every node's fx/fy).
      graphData.nodes.forEach((n) => {
        if (!n.__userPinned) {
          n.fx = undefined;
          n.fy = undefined;
        }
      });
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
      setLoadError(null);
      setLoadStages([{ label: "Knowledge triples", detail: "fetching…" }]);
      try {
        const triples = await fetchTriples(endpoint);
        let baseGraphData = transformToGraphData(triples);

        if (showCreators) {
          baseGraphData = enhanceGraphDataWithCreators(baseGraphData, triples);
        }

        setLoadStages([
          { label: "Knowledge triples", detail: String(triples.length), done: true },
          {
            label: "Atoms",
            detail: String(baseGraphData.nodes.length),
            done: true,
          },
        ]);
        setInitialGraphData(baseGraphData);
        // A live trust mode owns the canvas; only the global view paints here.
        if (tunnelModeRef.current === "global") {
          setGraphData(baseGraphData);
          setEmptyInfo(null);
        }
      } catch (error) {
        console.error("Error loading graph data:", error);
        setLoadError("Couldn't reach the Intuition mainnet API.");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [showCreators, endpoint, enhanceGraphDataWithCreators, reloadKey]);

  // Reality Tunnel: build the personalized subgraph for the active trust mode.
  // Claims about circle atoms + claims the circle (and, for "all", the viewer)
  // staked on, weighted by stake and capped to the strongest MAX_TRUST_TRIPLES.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (tunnelMode === "global") {
        setEmptyInfo(null);
        if (initialGraphData) setGraphData(initialGraphData);
        return;
      }
      const members = tunnel?.members || [];
      if (members.length === 0 && !tunnel?.selfAddress) {
        setGraphData({ nodes: [], links: [] });
        setEmptyInfo({
          title: "Nothing to show yet",
          body: "This mode has no accounts to draw from. Pick another mode in the Reality Tunnel panel.",
        });
        return;
      }
      setIsLoading(true);
      setLoadError(null);
      setEmptyInfo(null);
      setLoadStages([
        {
          label: "Trust circle",
          detail: `${members.length} account${members.length === 1 ? "" : "s"}`,
          done: true,
        },
        { label: "Staked claims & positions", detail: "fetching…" },
      ]);
      try {
        const { triples, weights, counts } = await fetchTrustGraph(members, {
          selfAddress: tunnel?.selfAddress || null,
          endpoint,
        });
        if (cancelled) return;
        setLoadStages([
          {
            label: "Trust circle",
            detail: `${members.length} account${members.length === 1 ? "" : "s"}`,
            done: true,
          },
          {
            label: "Claims",
            detail: `${counts.about} about · ${counts.staked} staked`,
            done: true,
          },
          { label: "Positions", detail: String(counts.positions), done: true },
        ]);

        const ranked = [...triples].sort(
          (a, b) => (weights[b.id] || 0) - (weights[a.id] || 0)
        );
        const kept = ranked.slice(0, MAX_TRUST_TRIPLES);
        if (kept.length === 0) {
          setGraphData({ nodes: [], links: [] });
          setEmptyInfo({
            title: "No staked claims found",
            body:
              tunnelMode === "single"
                ? "This account hasn't staked on any claims and nothing is claimed about it yet."
                : "Nobody in this trust circle has staked on a claim and nothing is claimed about them yet. Switch to Global to see the whole graph.",
          });
          return;
        }

        let trustGraph = transformToGraphData(kept);
        if (showCreators) {
          trustGraph = enhanceGraphDataWithCreators(trustGraph, kept);
        }
        applyTrustWeights(trustGraph, kept, weights);
        setGraphData(trustGraph);
      } catch (e) {
        console.error("Error building trust-tunnel graph:", e);
        if (!cancelled) setLoadError("Couldn't load the trust-tunnel graph.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [
    tunnel,
    tunnelMode,
    endpoint,
    showCreators,
    enhanceGraphDataWithCreators,
    initialGraphData,
    reloadKey,
  ]);

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
    // 3D: frame the whole graph once it settles so it's centered/visible (it
    // otherwise loads near-empty, especially on a phone). zoomToFit is the
    // ForceGraph3D camera-fit method; the padding leaves a small margin.
    if (!didInitialFitRef.current && fgRef.current && viewMode === "3D") {
      didInitialFitRef.current = true;
      try {
        fgRef.current.zoomToFit(600, isMobile ? 60 : 120);
      } catch (e) {
        /* noop */
      }
      return;
    }
    // First time the simulation settles: frame the whole graph generously and
    // then pull WAY back so it reads as a sparse "universe" of cluster anchors.
    if (!didInitialFitRef.current && fgRef.current && viewMode === "2D") {
      didInitialFitRef.current = true;
      const fg = fgRef.current;
      try {
        const meta = radialMetaRef.current;
        if (clusterMode === "radial" && meta && meta.r1 > 0) {
          // Explicitly frame the hub RING: center on origin and pick a zoom so
          // the ring (radius r1, plus its short object spokes) fills ~78% of the
          // viewport. This guarantees a clean "universe" of subject dots — never
          // an empty void or an off-screen ring. zoomToFit can't be trusted here
          // because shared-object placements scatter the bounding box.
          const W = window.innerWidth || 1600;
          const H = window.innerHeight || 900;
          const span = meta.r2 || meta.r1 * 1.25; // ring + spoke reach
          const target = (0.82 * Math.min(W, H)) / (2 * span);
          universeZoomRef.current = target;
          fg.centerAt(0, 0, 500);
          fg.zoom(target, 600);
        } else {
          fg.zoomToFit(400, 90);
          setTimeout(() => {
            try {
              const k = fg.zoom();
              const factor = clusterMode === "none" ? 0.6 : 0.5;
              const target = Math.max(k * factor, 0.005);
              universeZoomRef.current = target;
              fg.zoom(target, 600);
            } catch (e) {
              /* noop */
            }
          }, 450);
        }
      } catch (e) {
        /* noop */
      }
    }
  }, [isInitialLoad, viewMode, clusterMode, isMobile]);

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
        setEmptyInfo({
          title: "No matching claims",
          body: "Nothing in the graph matches these search filters. Clear them to restore the view.",
        });
        return;
      }

      setEmptyInfo(null);
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

  const retryLoad = useCallback(() => {
    setLoadError(null);
    setReloadKey((k) => k + 1);
  }, []);

  return (
    <div onMouseMove={handleContainerMouseMove}>
      <ControlDock
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        endpoint={endpoint}
        onEndpointChange={onEndpointChange}
        tunnelProps={{
          address,
          addressLabel: accountLabel,
          addressSource,
          endpoint,
          onChange: onTunnelChange,
          onAddressOverride,
        }}
        clusterMode={clusterMode}
        onClusterModeChange={setClusterMode}
        predicateList={predicateList}
        enabledPredicates={enabledPredicates}
        isPredicateOn={isPredicateOn}
        onTogglePredicate={togglePredicate}
        onAllPredicates={allPredicatesOn}
        showCreators={showCreators}
        onShowCreatorsChange={setShowCreators}
        filters={{
          subject: subjectFilter,
          predicate: predicateFilter,
          object: objectFilter,
        }}
        onFilterChange={handleSearchInput}
        onResetGraph={resetGraph}
        onBack={goBack}
        onForward={goForward}
        canBack={currentHistoryIndex > 0}
        canForward={currentHistoryIndex < graphHistory.length - 1}
      />

      {loadError && (
        <div className="error-banner" role="alert">
          <span className="error-banner-text">{loadError}</span>
          <button type="button" className="dock-btn" onClick={retryLoad}>
            Retry
          </button>
          <button
            type="button"
            className="error-banner-close"
            title="Dismiss"
            onClick={() => setLoadError(null)}
          >
            ✕
          </button>
        </div>
      )}

      {(isLoading || isSearching) && viewMode !== "focus" && (
        <div className="load-card">
          <div className="load-card-title">
            <span className="load-spinner" />
            {isSearching ? "Searching the graph" : "Loading graph"}
          </div>
          {loadStages.map((s) => (
            <div key={s.label} className={`load-stage${s.done ? " done" : ""}`}>
              <span className="load-stage-mark">{s.done ? "✓" : "•"}</span>
              <span className="load-stage-label">{s.label}</span>
              <span className="load-stage-detail">{s.detail}</span>
            </div>
          ))}
        </div>
      )}

      {emptyInfo && !isLoading && !isSearching && viewMode !== "focus" && (
        <div className="empty-overlay">
          <div className="empty-card">
            <div className="empty-card-title">{emptyInfo.title}</div>
            <div className="empty-card-body">{emptyInfo.body}</div>
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
          graphData={visibleGraph}
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
            // Semantic "map" zoom (level-of-detail), expressed as a RATIO to the
            // settled universe zoom so it feels the same at any graph size. Like
            // a map that shows only dots fully zoomed out and reveals names as
            // you zoom in:
            //   z < 1.3 -> "universe": subject hubs as dots (objects hidden),
            //              only the biggest hubs labelled.
            //   1.3..3  -> "region": object leaves fade in.
            //   z > ~3  -> "streets": hub labels then object labels appear.
            const k = globalScale;
            const z = k / (universeZoomRef.current || 0.4);
            const clustering = clusterMode !== "none";
            const isRadial = clusterMode === "radial";
            const isAnchor = clustering && node.isAnchor;
            const isBigHub = isAnchor && bigHubIds.has(node.id);

            const trust = node.trust;
            const hasTrust = typeof trust === "number";
            const isFocused =
              hoverNode?.id === node.id || selectedTriple?.id === node.id;

            // Object-leaf visibility ramps in as we zoom from universe->region.
            // Subject hubs (anchors) are always visible as dots. Without
            // clustering everything behaves like a leaf (plain mode still LODs).
            let memberAlpha = 1;
            if (!isAnchor) {
              if (isRadial) {
                // Object leaves: hidden in the universe band, fade in as you
                // zoom past it so the zoomed-out view is clean subject dots.
                if (z < 1.4) memberAlpha = 0;
                else if (z < 2.6) memberAlpha = (z - 1.4) / 1.2;
                else memberAlpha = 1;
              } else if (z < 1.4) memberAlpha = clustering ? 0 : 0.3;
              else if (z < 2.6) memberAlpha = (z - 1.4) / 1.2;
              else memberAlpha = 1;
            }
            if (isFocused) memberAlpha = 1;
            if (memberAlpha <= 0.02) {
              node.__bckgDimensions = [2, 2];
              return;
            }

            // Radius: subject hubs big and zoom-stable (scale with branch
            // count); object leaves small (scale with trust when present).
            // On a phone everything gets a ~1.5x bump so nodes are visible + the
            // tap target (driven off baseR below) is fat-finger friendly.
            const mobileScale = isMobile ? 1.5 : 1;
            const baseR =
              (isAnchor
                ? 6 + Math.min((node.triples?.length || 1) * 0.3, 9)
                : 3 + (hasTrust ? trust * 6 : 1.2)) * mobileScale;
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

            // ---- Labels (map-like LOD) ----
            // At the lowest "universe" zoom we label ONLY the biggest hubs —
            // like a map showing just major city names. As you zoom in,
            // subject-hub labels appear first (z>1.6), then object-leaf labels
            // (z>3) — like a map revealing street names. Hover/focus always
            // labels regardless of zoom.
            let showLabel;
            if (isAnchor) {
              if (isFocused) showLabel = true;
              else if (z < 1.4) showLabel = isBigHub; // universe: big hubs only
              else showLabel = z > 1.6; // region+: all hub labels
            } else {
              showLabel =
                isFocused || (hasTrust && trust > 0.4) || z > 3.0;
            }
            if (!showLabel) {
              node.__bckgDimensions = [dotRadius * 2, dotRadius * 2];
              return;
            }

            const label = truncate(node.label, isAnchor ? 26 : 22);
            const fontPx =
              (isAnchor
                ? Math.max(13, isFocused ? 14 : 12)
                : isFocused
                ? 12
                : 10) * mobileScale;
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
            // Fatten the tap target on touch so small leaves are still hittable.
            ctx.beginPath();
            ctx.arc(node.x, node.y, Math.max(r, isMobile ? 8 : 4), 0, 2 * Math.PI);
            ctx.fill();
          }}
          linkColor={(l) => {
            // Each edge IS a predicate branch — color it by its predicate. At
            // the zoomed-out "universe" level fade branches so subject dots read
            // cleanly; they strengthen as you zoom in (map-like).
            const base = l.color || "#888";
            const z = zoomRef.current / (universeZoomRef.current || 0.4);
            let a;
            if (typeof l.trust === "number") a = 0.4 + l.trust * 0.55;
            else if (z < 1.4) a = 0.16;
            else if (z < 2.6) a = 0.16 + (z - 1.4) * (0.64 / 1.2);
            else a = 0.8;
            const hex = Math.round(Math.min(a, 1) * 255)
              .toString(16)
              .padStart(2, "0");
            return base + hex;
          }}
          linkWidth={(l) =>
            typeof l.trust === "number"
              ? 1 + l.trust * 4
              : zoomRef.current / (universeZoomRef.current || 0.4) > 2
              ? 1.4
              : 1
          }
          linkDirectionalParticles={(l) =>
            zoomRef.current / (universeZoomRef.current || 0.4) > 3 ||
            typeof l.trust === "number"
              ? 1
              : 0
          }
          linkDirectionalParticleSpeed={0.02}
          linkDirectionalParticleColor={(l) => l.color || "#fff"}
          linkCanvasObjectMode={() => "after"}
          linkCanvasObject={(link, ctx, globalScale) => {
            // Map-like predicate edge-labels: reveal predicate names on the
            // branches only when zoomed well in (z>3.4), or when either endpoint
            // is hovered/selected. Keeps the universe clean, names appear like
            // street labels as you zoom.
            const k = globalScale;
            const z = k / (universeZoomRef.current || 0.4);
            const s = link.source;
            const t = link.target;
            if (!s || !t || typeof s.x !== "number" || typeof t.x !== "number")
              return;
            const focused =
              hoverNode &&
              (hoverNode.id === s.id || hoverNode.id === t.id);
            if (!focused && z < 3.4) return;
            const label = truncate(link.predicate, 22);
            if (!label) return;
            const mx = (s.x + t.x) / 2;
            const my = (s.y + t.y) / 2;
            const fontSize = (focused ? 11 : 9) / k;
            ctx.font = `${fontSize}px Sans-Serif`;
            const w = ctx.measureText(label).width;
            const pad = 3 / k;
            ctx.fillStyle = "rgba(10,12,18,0.72)";
            ctx.fillRect(mx - w / 2 - pad, my - fontSize / 2 - pad, w + pad * 2, fontSize + pad * 2);
            ctx.fillStyle = (link.color || "#ddd") + "FF";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, mx, my);
          }}
          nodeAutoColorBy="type"
          onNodeClick={handleNodeClickWithCluster}
          onEngineStop={handleEngineStop}
        />
      )}

      {viewMode === "3D" && (
        <ForceGraph3D
          ref={(el) => (fgRef.current = el)}
          graphData={visibleGraph}
          // Touch screens have no keyboard: use OrbitControls (one-finger rotate,
          // pinch zoom, two-finger pan) instead of the desktop fly controls, and
          // hide the WASD nav hint that only applies to fly.
          controlType={isMobile ? "orbit" : "fly"}
          showNavInfo={!isMobile}
          nodeLabel="label"
          onNodeClick={handleNodeClick}
          linkColor={(l) => l.color || "#888"}
          linkWidth={(l) => (typeof l.trust === "number" ? 0.5 + l.trust * 3 : 0.5)}
          linkDirectionalParticles={2}
          linkDirectionalParticleSpeed={0.005}
          nodeAutoColorBy="type"
          // Bigger spheres on a phone so nodes are visible + easy to tap.
          nodeRelSize={isMobile ? 6 : 4}
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
            // Larger label text on mobile for legibility.
            const baseH = hasTrust ? 3 + trust * 4 : 3;
            sprite.textHeight = isMobile ? baseH * 1.5 : baseH;
            return sprite;
          }}
          nodeThreeObjectExtend={true}
          onEngineStop={handleEngineStop}
        />
      )}

      {viewMode === "VR" && (
        <GraphVR
          graphData={visibleGraph}
          onNodeClick={handleNodeClick}
          onBack={goBack}
          onForward={goForward}
          selectedTriple={selectedTriple}
        />
      )}

      {viewMode === "focus" && (
        <FocusGraph endpoint={endpoint} address={address} />
      )}

      {viewMode !== "focus" && (
        <div className="stats-strip">
          <span className="stats-item">
            <b>{visibleGraph.nodes.length}</b> nodes
          </span>
          <span className="stats-item">
            <b>{visibleGraph.links.length}</b> edges
          </span>
          <span className="stats-item stats-mode">
            {MODE_LABELS[tunnelMode] || tunnelMode}
          </span>
          <span className="stats-item stats-source">
            <span className="env-dot" />
            {ENDPOINTS[endpoint]?.displayName || endpoint}
          </span>
        </div>
      )}

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
