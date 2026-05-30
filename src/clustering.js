// src/clustering.js
// Clustering helpers for the 2D force graph.
//
// "Cluster by Predicate" groups every triple that shares a predicate; the
// predicate atom is the cluster anchor. "Cluster by Subject" groups by the
// subject atom (the anchor). Anchors get persistent prominent labels so a
// cluster is identifiable even when zoomed all the way out.

// Pick which nodes act as cluster anchors for a given mode, and assign every
// node a `clusterKey` (the id of the cluster it belongs to). Anchors are tagged
// `isAnchor` and laid out on a ring so clusters start visually separated.
//
// Returns { anchors: Map<clusterKey, anchorNode>, clusterKeyOf: (node)=>key }.
export const computeClusters = (nodes, mode) => {
  const anchors = new Map();
  if (mode === "none") return { anchors, clusterKeyOf: () => null };

  const groupField = mode === "predicate" ? "predicateGroups" : "subjectGroups";
  const anchorRole = mode === "predicate" ? "predicate" : "subject";

  // Anchor candidates: nodes that actually play the anchor role.
  nodes.forEach((n) => {
    if (n.roles && n.roles.has(anchorRole)) {
      anchors.set(n.id, n);
    }
  });

  // Assign each node to the anchor cluster it most belongs to. A node can touch
  // several clusters (e.g. an object linked under several predicates); we use
  // the first/most-frequent group key for a stable centroid pull.
  const clusterKeyOf = (node) => {
    if (node.isAnchor) return node.id;
    const groups = node[groupField];
    if (!groups || groups.size === 0) return null;
    // Prefer a group whose anchor exists in this graph.
    for (const key of groups) {
      if (anchors.has(key)) return key;
    }
    return groups.values().next().value;
  };

  return { anchors, clusterKeyOf };
};

// Lay anchors out evenly on a ring so clusters don't all start stacked at the
// origin. Mutates anchor nodes with `fx/fy` (fixed) when `pin` is true, else
// just seeds x/y. Radius scales with the number of clusters.
export const layoutAnchors = (anchors, { pin = false } = {}) => {
  const list = Array.from(anchors.values());
  const count = list.length || 1;
  const radius = Math.max(220, count * 55);
  list.forEach((anchor, i) => {
    const angle = (i / count) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    anchor.isAnchor = true;
    anchor.__clusterX = x;
    anchor.__clusterY = y;
    if (pin) {
      anchor.fx = x;
      anchor.fy = y;
    } else {
      if (anchor.x == null) anchor.x = x;
      if (anchor.y == null) anchor.y = y;
    }
  });
  return list;
};

// A d3 cluster force: pulls every node toward its cluster anchor's seeded
// position. Anchors themselves are pulled toward their ring slot. Strength is
// tunable; returns a force function compatible with simulation.force(name, fn).
export const makeClusterForce = (anchors, clusterKeyOf, strength = 0.08) => {
  let nodes = [];
  const force = (alpha) => {
    const k = strength * alpha;
    nodes.forEach((node) => {
      let targetX;
      let targetY;
      if (node.isAnchor) {
        targetX = node.__clusterX;
        targetY = node.__clusterY;
      } else {
        const key = clusterKeyOf(node);
        const anchor = key != null ? anchors.get(key) : null;
        if (!anchor) return;
        targetX = anchor.__clusterX != null ? anchor.__clusterX : anchor.x;
        targetY = anchor.__clusterY != null ? anchor.__clusterY : anchor.y;
      }
      if (targetX == null || targetY == null) return;
      node.vx += (targetX - node.x) * k;
      node.vy += (targetY - node.y) * k;
    });
  };
  force.initialize = (n) => {
    nodes = n;
  };
  return force;
};
