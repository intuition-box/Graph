// src/FocusGraph.js
// Arkham-style FOCUS mode: an expand-on-demand graph explorer.
//
// Instead of dumping the whole knowledge graph (a hairball), we start from a
// single FOCAL atom and render only it + its immediate (1-hop) neighbors.
// Clicking any node expands ITS neighbors into the view; clicking an expanded
// node collapses the nodes that expansion brought in. The graph grows by
// exploration, so it stays inherently decluttered.
//
// Edges are directed arrows Subject -> Object carrying the PREDICATE as the
// label (the existing predicate-as-edge model). Nodes are colored + shaped by
// atom TYPE (see nodeColors.getTypeStyle). A details panel (NodeDetailsSidebar)
// opens on click and a "Reset to focal" control returns to the starting node.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ForceGraph2D } from "react-force-graph";
import { fetchNeighborTriples, fetchTriples } from "./api";
import { fetchTrustCircle } from "./trustCircle";
import { getTypeStyle, TYPE_STYLES } from "./nodeColors";
import NodeDetailsSidebar from "./NodeDetailsSidebar";

// Max neighbors revealed per expansion before the rest are gated behind a
// "show more" — keeps even a very high-degree node readable.
const NEIGHBOR_LIMIT = 12;

// Treat narrow viewports as mobile: panels collapse by default + nodes/labels
// get a touch-friendly size bump.
const MOBILE_BP = 768;
const isMobileViewport = () =>
  typeof window !== "undefined" && window.innerWidth <= MOBILE_BP;

const truncate = (s, max = 20) => {
  const str = String(s || "");
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
};

// Read ?focus=<atomId> from the URL (explicit focal override). Returns null when
// absent so the caller can fall back to the trust-circle root / busiest atom.
const getFocusOverride = () => {
  try {
    const v = (new URLSearchParams(window.location.search).get("focus") || "").trim();
    return v || null;
  } catch {
    return null;
  }
};

// Turn a list of {id, subject, predicate, object} triples into the node/link
// shape ForceGraph wants, but keyed per-OWNER so we can collapse later. Every
// node/link records `owners` (the set of expanded atom ids that introduced it).
// `ownerId` is the atom whose expansion produced these triples.
const triplesToElements = (triples, ownerId) => {
  const nodes = new Map();
  const links = [];
  const ensure = (atom) => {
    if (!atom) return;
    if (!nodes.has(atom.id)) {
      const style = getTypeStyle(atom.type);
      nodes.set(atom.id, {
        id: atom.id,
        label: atom.label || atom.id,
        type: atom.type || null,
        color: style.color,
        shape: style.shape,
        owners: new Set([ownerId]),
      });
    } else {
      nodes.get(atom.id).owners.add(ownerId);
    }
  };
  triples.forEach((t) => {
    if (!t.subject || !t.object || !t.predicate) return;
    ensure(t.subject);
    ensure(t.object);
    links.push({
      id: t.id,
      source: t.subject.id,
      target: t.object.id,
      predicate: t.predicate.label,
      predicateId: t.predicate.id,
      owners: new Set([ownerId]),
    });
  });
  return { nodes: Array.from(nodes.values()), links };
};

const FocusGraph = ({ endpoint, address }) => {
  const fgRef = useRef();
  const [graph, setGraph] = useState({ nodes: [], links: [] });
  const [focalId, setFocalId] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set()); // atom ids expanded
  const [truncatedFor, setTruncatedFor] = useState(() => new Set()); // owners w/ hidden neighbors
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  // Mobile: panels start collapsed so they don't cover the graph; a small toggle
  // re-opens them. `isMobile` also scales node hit-area + label size for touch.
  const [isMobile, setIsMobile] = useState(isMobileViewport);
  const [panelOpen, setPanelOpen] = useState(() => !isMobileViewport());
  const [legendOpen, setLegendOpen] = useState(() => !isMobileViewport());
  useEffect(() => {
    const onResize = () => setIsMobile(isMobileViewport());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const focusOverride = useMemo(() => getFocusOverride(), []);

  // Merge freshly-fetched elements into the current graph, preserving existing
  // node objects (so force positions/pins survive) and union-ing `owners`. New
  // nodes spawn near the owner so they animate outward from it.
  const mergeElements = useCallback((incoming, ownerId) => {
    setGraph((prev) => {
      const nodeById = new Map(prev.nodes.map((n) => [n.id, n]));
      const owner = ownerId ? nodeById.get(ownerId) : null;
      incoming.nodes.forEach((n) => {
        const existing = nodeById.get(n.id);
        if (existing) {
          n.owners.forEach((o) => existing.owners.add(o));
        } else {
          if (owner && typeof owner.x === "number") {
            n.x = owner.x + (Math.random() - 0.5) * 30;
            n.y = owner.y + (Math.random() - 0.5) * 30;
          }
          nodeById.set(n.id, n);
        }
      });
      const linkKey = (l) =>
        `${l.id}|${typeof l.source === "object" ? l.source.id : l.source}->${
          typeof l.target === "object" ? l.target.id : l.target
        }`;
      const linkByKey = new Map(prev.links.map((l) => [linkKey(l), l]));
      incoming.links.forEach((l) => {
        const k = linkKey(l);
        const existing = linkByKey.get(k);
        if (existing) {
          l.owners.forEach((o) => existing.owners.add(o));
        } else {
          linkByKey.set(k, l);
        }
      });
      return {
        nodes: Array.from(nodeById.values()),
        links: Array.from(linkByKey.values()),
      };
    });
  }, []);

  // Fetch the 1-hop neighborhood for an atom and merge the top-N neighbors in.
  // The focal load also seeds the very first node. Returns nothing; updates
  // state. `showAll` lifts the per-owner neighbor cap ("show more").
  const expandNode = useCallback(
    async (atomId, { showAll = false } = {}) => {
      if (!atomId) return;
      setLoading(true);
      setStatus("");
      try {
        const triples = await fetchNeighborTriples(atomId, endpoint);
        const { nodes, links } = triplesToElements(triples, atomId);

        // Rank neighbor links by the neighbor's own degree in this batch so the
        // best-connected (most relevant) neighbors show first when truncating.
        const degree = new Map();
        links.forEach((l) => {
          degree.set(l.source, (degree.get(l.source) || 0) + 1);
          degree.set(l.target, (degree.get(l.target) || 0) + 1);
        });
        const otherEnd = (l) => (l.source === atomId ? l.target : l.source);
        const ranked = [...links].sort(
          (a, b) => (degree.get(otherEnd(b)) || 0) - (degree.get(otherEnd(a)) || 0)
        );

        let keepLinks = ranked;
        let isTruncated = false;
        if (!showAll && ranked.length > NEIGHBOR_LIMIT) {
          keepLinks = ranked.slice(0, NEIGHBOR_LIMIT);
          isTruncated = true;
        }
        const keepNodeIds = new Set([atomId]);
        keepLinks.forEach((l) => {
          keepNodeIds.add(l.source);
          keepNodeIds.add(l.target);
        });
        const keepNodes = nodes.filter((n) => keepNodeIds.has(n.id));

        mergeElements({ nodes: keepNodes, links: keepLinks }, atomId);
        setExpanded((prev) => new Set(prev).add(atomId));
        setTruncatedFor((prev) => {
          const next = new Set(prev);
          if (isTruncated) next.add(atomId);
          else next.delete(atomId);
          return next;
        });
        if (keepNodes.length <= 1) {
          setStatus("No further connections found for this node.");
        }
      } catch (e) {
        console.error("Focus expand failed:", e);
        setStatus("Couldn't load connections for this node.");
      } finally {
        setLoading(false);
      }
    },
    [endpoint, mergeElements]
  );

  // Collapse a node: remove every node/link that ONLY this node's expansion
  // brought in (owner set becomes empty once we drop this owner). The focal node
  // and anything still reachable from another expansion stay.
  const collapseNode = useCallback(
    (atomId) => {
      setGraph((prev) => {
        const links = prev.links
          .map((l) => {
            if (l.owners.has(atomId) && l.owners.size === 1) return null;
            l.owners.delete(atomId);
            return l;
          })
          .filter(Boolean);
        const nodes = prev.nodes
          .map((n) => {
            if (n.id === focalId) return n; // never drop the focal node
            if (n.owners.has(atomId) && n.owners.size === 1) return null;
            n.owners.delete(atomId);
            return n;
          })
          .filter(Boolean);
        // Drop any node now orphaned (no incident link and not the focal node).
        const linked = new Set();
        links.forEach((l) => {
          linked.add(typeof l.source === "object" ? l.source.id : l.source);
          linked.add(typeof l.target === "object" ? l.target.id : l.target);
        });
        return {
          nodes: nodes.filter((n) => n.id === focalId || linked.has(n.id)),
          links,
        };
      });
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(atomId);
        return next;
      });
      setTruncatedFor((prev) => {
        const next = new Set(prev);
        next.delete(atomId);
        return next;
      });
    },
    [focalId]
  );

  // Resolve the default focal atom: ?focus= override, else the connected
  // wallet's trust-circle root, else the busiest atom in the global sample.
  const resolveFocal = useCallback(async () => {
    if (focusOverride) return focusOverride;
    if (address) {
      try {
        const circle = await fetchTrustCircle(address, endpoint);
        if (circle.length > 0 && circle[0].atomId) return circle[0].atomId;
      } catch (e) {
        /* fall through to busiest-atom default */
      }
    }
    // Fallback: pick the most-connected atom from the global triple sample.
    try {
      const triples = await fetchTriples(endpoint);
      const degree = new Map();
      triples.forEach((t) => {
        [t.subject, t.object].forEach((a) => {
          if (a) degree.set(a.id, (degree.get(a.id) || 0) + 1);
        });
      });
      let best = null;
      let bestDeg = -1;
      degree.forEach((d, id) => {
        if (d > bestDeg) {
          bestDeg = d;
          best = id;
        }
      });
      return best;
    } catch (e) {
      return null;
    }
  }, [focusOverride, address, endpoint]);

  // Initial load + reload whenever the focal-source inputs change. Resets the
  // explored graph and seeds it from the resolved focal atom's neighborhood.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setStatus("");
      setGraph({ nodes: [], links: [] });
      setExpanded(new Set());
      setTruncatedFor(new Set());
      setSelected(null);
      const focal = await resolveFocal();
      if (cancelled) return;
      if (!focal) {
        setLoading(false);
        setStatus("No focal atom available. Try ?focus=<atomId> in the URL.");
        return;
      }
      setFocalId(focal);
      // expandNode handles its own loading flag.
      await expandNode(focal);
    };
    run();
    return () => {
      cancelled = true;
    };
    // resolveFocal/expandNode are stable per their own deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, address, focusOverride]);

  // Frame the graph after the first nodes settle.
  const didFitRef = useRef(false);
  useEffect(() => {
    didFitRef.current = false;
  }, [focalId]);
  const handleEngineStop = useCallback(() => {
    if (!didFitRef.current && fgRef.current && graph.nodes.length) {
      didFitRef.current = true;
      try {
        fgRef.current.zoomToFit(500, 70);
      } catch (e) {
        /* noop */
      }
    }
  }, [graph.nodes.length]);

  // Node click: open details, then expand (or collapse if already expanded).
  const handleNodeClick = useCallback(
    (node) => {
      setSelected(node);
      if (expanded.has(node.id)) {
        if (node.id !== focalId) collapseNode(node.id);
      } else {
        expandNode(node.id);
      }
      if (fgRef.current && typeof node.x === "number") {
        try {
          fgRef.current.centerAt(node.x, node.y, 500);
        } catch (e) {
          /* noop */
        }
      }
    },
    [expanded, focalId, expandNode, collapseNode]
  );

  // Collapse the whole exploration back to just the focal node's fresh 1-hop
  // neighborhood: wipe state, then re-expand the focal atom.
  const resetToFocal = useCallback(() => {
    if (!focalId) return;
    didFitRef.current = false;
    setSelected(null);
    setGraph({ nodes: [], links: [] });
    setExpanded(new Set());
    setTruncatedFor(new Set());
    expandNode(focalId);
  }, [focalId, expandNode]);

  const focalNode = useMemo(
    () => graph.nodes.find((n) => n.id === focalId) || null,
    [graph.nodes, focalId]
  );
  const truncatedOwners = useMemo(
    () =>
      [...truncatedFor]
        .map((id) => graph.nodes.find((n) => n.id === id))
        .filter(Boolean),
    [truncatedFor, graph.nodes]
  );

  // Draw a node as a colored type-shape with a small label below it.
  const drawNode = useCallback(
    (node, ctx, scale) => {
      const isFocal = node.id === focalId;
      const isExpanded = expanded.has(node.id);
      const isSel = selected?.id === node.id;
      // Bump node radius on touch screens so fat-finger taps land.
      const baseR = isFocal ? 9 : 6;
      const r = (isMobile ? baseR * 1.5 : baseR) / scale;
      const x = node.x;
      const y = node.y;
      ctx.fillStyle = node.color || "#8A93A6";
      ctx.beginPath();
      switch (node.shape) {
        case "square":
          ctx.rect(x - r, y - r, r * 2, r * 2);
          break;
        case "diamond":
          ctx.moveTo(x, y - r * 1.2);
          ctx.lineTo(x + r * 1.2, y);
          ctx.lineTo(x, y + r * 1.2);
          ctx.lineTo(x - r * 1.2, y);
          ctx.closePath();
          break;
        case "triangle":
          ctx.moveTo(x, y - r * 1.2);
          ctx.lineTo(x + r * 1.1, y + r);
          ctx.lineTo(x - r * 1.1, y + r);
          ctx.closePath();
          break;
        default:
          ctx.arc(x, y, r, 0, 2 * Math.PI);
      }
      ctx.fill();

      // Ring: white for focal/selected, soft accent for expanded.
      if (isFocal || isSel) {
        ctx.lineWidth = 2.5 / scale;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
      } else if (isExpanded) {
        ctx.lineWidth = 1.5 / scale;
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.stroke();
      }

      // Label below the node.
      const fontSize = ((isFocal ? 12 : 10) * (isMobile ? 1.3 : 1)) / scale;
      const label = truncate(node.label, isFocal ? 26 : 18);
      ctx.font = `${isFocal ? "600 " : ""}${fontSize}px Sans-Serif`;
      const w = ctx.measureText(label).width;
      const pad = 3 / scale;
      const ly = y + r + fontSize / 2 + pad + 1 / scale;
      ctx.fillStyle = "rgba(10,12,18,0.72)";
      ctx.fillRect(x - w / 2 - pad, ly - fontSize / 2 - pad, w + pad * 2, fontSize + pad * 2);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x, ly);

      node.__r = r;
    },
    [focalId, expanded, selected, isMobile]
  );

  return (
    <div>
      {loading && (
        <div className="load-card">
          <div className="load-card-title">
            <span className="load-spinner" />
            Loading connections
          </div>
        </div>
      )}

      {/* Focus controls */}
      <div className={`focus-panel${panelOpen ? "" : " collapsed"}`}>
        <div className="focus-panel-head">
          <span className="dock-section-title">Focus</span>
          <button
            type="button"
            className="focus-panel-toggle"
            onClick={() => setPanelOpen((v) => !v)}
            aria-expanded={panelOpen}
            title={panelOpen ? "Hide focus panel" : "Show focus panel"}
          >
            {panelOpen ? "▾" : "▸"}
          </button>
          <button
            type="button"
            className="dock-btn"
            onClick={resetToFocal}
            disabled={!focalId}
            title="Collapse everything back to the focal node"
          >
            Reset to focal
          </button>
        </div>
        {panelOpen && (
        <>
        <div className="focus-focal">
          {focalNode ? (
            <>
              <span
                className="focus-focal-dot"
                style={{ background: focalNode.color }}
              />
              <span className="focus-focal-label" title={focalNode.label}>
                {truncate(focalNode.label, 28)}
              </span>
            </>
          ) : (
            <span className="focus-focal-label">Resolving focal node…</span>
          )}
        </div>
        <div className="focus-hint">
          Click a node to expand its connections · click an expanded node to
          collapse · {graph.nodes.length} shown
        </div>
        {truncatedOwners.length > 0 && (
          <div className="focus-more">
            {truncatedOwners.map((n) => (
              <button
                key={n.id}
                type="button"
                className="focus-more-btn"
                onClick={() => expandNode(n.id, { showAll: true })}
                title={`Show all connections of ${n.label}`}
              >
                Show more · {truncate(n.label, 16)}
              </button>
            ))}
          </div>
        )}
        {status && <div className="focus-status">{status}</div>}
        </>
        )}
      </div>

      {/* Type legend */}
      <div className={`focus-legend${legendOpen ? "" : " collapsed"}`}>
        <button
          type="button"
          className="focus-legend-toggle"
          onClick={() => setLegendOpen((v) => !v)}
          aria-expanded={legendOpen}
          title={legendOpen ? "Hide legend" : "Show atom types"}
        >
          {legendOpen ? "✕" : "ⓘ"}
        </button>
        {legendOpen && (
        <>
        <div className="dock-section-title" style={{ marginBottom: 6 }}>
          Atom type
        </div>
        {Object.values(TYPE_STYLES).map((t) => (
          <div key={t.label} className="focus-legend-row">
            <span
              className="focus-legend-dot"
              style={{
                background: t.color,
                borderRadius: t.shape === "circle" ? "50%" : 2,
                transform: t.shape === "diamond" ? "rotate(45deg)" : "none",
              }}
            />
            {t.label}
          </div>
        ))}
        </>
        )}
      </div>

      <ForceGraph2D
        ref={(el) => (fgRef.current = el)}
        graphData={graph}
        cooldownTicks={120}
        warmupTicks={10}
        d3VelocityDecay={0.3}
        nodeRelSize={6}
        nodeCanvasObject={drawNode}
        nodePointerAreaPaint={(node, color, ctx) => {
          ctx.fillStyle = color;
          const r = (node.__r || 6) + (isMobile ? 8 : 3);
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          ctx.fill();
        }}
        linkColor={() => "rgba(180,190,210,0.55)"}
        linkWidth={1.2}
        linkDirectionalArrowLength={4.5}
        linkDirectionalArrowRelPos={0.92}
        linkDirectionalParticles={1}
        linkDirectionalParticleSpeed={0.012}
        linkDirectionalParticleWidth={2}
        linkCanvasObjectMode={() => "after"}
        linkCanvasObject={(link, ctx, scale) => {
          const s = link.source;
          const t = link.target;
          if (!s || !t || typeof s.x !== "number" || typeof t.x !== "number")
            return;
          // Only label when zoomed in enough to read; a touch device has no
          // hover to reveal them, so surface a little earlier there.
          if (scale < (isMobile ? 0.8 : 1.1)) return;
          const label = truncate(link.predicate, 22);
          if (!label) return;
          const mx = (s.x + t.x) / 2;
          const my = (s.y + t.y) / 2;
          const fontSize = 9 / scale;
          ctx.font = `${fontSize}px Sans-Serif`;
          const w = ctx.measureText(label).width;
          const pad = 2.5 / scale;
          ctx.fillStyle = "rgba(10,12,18,0.75)";
          ctx.fillRect(mx - w / 2 - pad, my - fontSize / 2 - pad, w + pad * 2, fontSize + pad * 2);
          ctx.fillStyle = "#cfe0ff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, mx, my);
        }}
        onNodeClick={handleNodeClick}
        onEngineStop={handleEngineStop}
      />

      {selected && (
        <NodeDetailsSidebar
          triple={selected}
          endpoint={endpoint}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
};

export default FocusGraph;
