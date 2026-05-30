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

// ---- Radial 3-level "branch" layout (subject -> predicate -> object) --------
//
// The user's primary vision: subject atoms at the CENTER, their predicates as
// branches at a mid radius (angularly near their subject), and the objects as
// leaves at the outer radius (near their predicate). Each subject becomes a
// little radial tree; together they read as a dendrogram-ish universe.
//
// We assign each node a PRIMARY LEVEL from its roles (a node can be a subject in
// one triple and an object in another):
//   - if it is ever a subject  -> level 1 (center hub)
//   - else if ever a predicate -> level 2 (branch)
//   - else                      -> level 3 (leaf)
//
// Then we give every subject an angular SECTOR. Within a subject's sector we
// fan out its predicates (level 2), and within each predicate's slice we fan
// out the objects (level 3). Positions are PINNED (fx/fy) for legibility and
// stability; a user drag re-pins wherever the node is dropped.
//
// Returns { subjects: Set<id>, levelOf: Map<id, 1|2|3> } so the renderer can
// treat subject hubs as the "anchors" for level-of-detail + labelling.
export const computeRadialLayout = (nodes, links, opts = {}) => {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // 1) Primary level per node.
  const levelOf = new Map();
  const subjects = new Set();
  nodes.forEach((n) => {
    const roles = n.roles instanceof Set ? n.roles : new Set([n.role]);
    if (roles.has("subject")) {
      levelOf.set(n.id, 1);
      subjects.add(n.id);
    } else if (roles.has("predicate")) {
      levelOf.set(n.id, 2);
    } else {
      levelOf.set(n.id, 3);
    }
  });

  // 2) Build the per-subject branch tree from triple membership. Each node
  //    carries `triples` (the {subject,predicate,object} it participates in).
  //    subjectTree: Map<subjectId, Map<predicateId, Set<objectId>>>
  const subjectTree = new Map();
  const ensure = (sid) => {
    if (!subjectTree.has(sid)) subjectTree.set(sid, new Map());
    return subjectTree.get(sid);
  };
  nodes.forEach((n) => {
    (n.triples || []).forEach((t) => {
      const sid = t.subject?.id;
      const pid = t.predicate?.id;
      const oid = t.object?.id;
      if (sid == null || !subjects.has(sid)) return;
      const preds = ensure(sid);
      if (pid == null) return;
      if (!preds.has(pid)) preds.set(pid, new Set());
      if (oid != null) preds.get(pid).add(oid);
    });
  });

  const subjectIds = Array.from(subjectTree.keys());
  const sCount = subjectIds.length || 1;

  // Radii scale with subject count so the inner ring of subject hubs has room to
  // breathe (no central blob) and the predicate/object rings stay clearly
  // separated. We size the inner ring from the desired arc-spacing between hubs:
  //   circumference = sCount * HUB_GAP  ->  innerR = sCount * HUB_GAP / (2π)
  // HUB_GAP is kept small so even a broad global graph (200+ subjects) stays at
  // a tractable scale for zoom/framing; the ring is still a clear circle.
  const HUB_GAP = 60; // target arc distance between adjacent subject hubs
  const innerR =
    opts.r1 != null
      ? opts.r1
      : sCount <= 1
      ? 0
      : Math.max(160, (sCount * HUB_GAP) / (2 * Math.PI));
  // Branch + leaf rings sit a generous gap outside the hub ring so each subject's
  // tree (subject -> predicate -> object) reads as a clean outward spoke. The gap
  // scales a little with the ring size so dense graphs keep their rings distinct.
  const ringGap = Math.max(360, innerR * 0.5);
  const r2 = opts.r2 != null ? opts.r2 : innerR + ringGap;
  const r3 = opts.r3 != null ? opts.r3 : r2 + ringGap;

  const placed = new Set();
  const setPos = (id, x, y, level) => {
    const node = byId.get(id);
    if (!node) return;
    node.__radX = x;
    node.__radY = y;
    node.__radLevel = level;
    placed.add(id);
  };

  // Each subject owns an angular SECTOR. Its predicates fan across that sector
  // (level-2 branches), and each predicate's objects fan in a slice around the
  // predicate's angle (level-3 leaves). A shared predicate/object is positioned
  // once, under the FIRST subject that claims it, so it sits inside a real
  // branch; cross-subject links to it still draw (they read as the branch).
  subjectIds.forEach((sid, si) => {
    const sectorMid = ((si + 0.5) / sCount) * Math.PI * 2;
    const sectorHalf = (Math.PI / sCount) * 0.92; // small gap between sectors

    if (sCount === 1) setPos(sid, 0, 0, 1);
    else
      setPos(sid, Math.cos(sectorMid) * innerR, Math.sin(sectorMid) * innerR, 1);

    const preds = subjectTree.get(sid);
    const predIds = Array.from(preds.keys());
    const pCount = predIds.length || 1;

    predIds.forEach((pid, pi) => {
      const pFrac = pCount === 1 ? 0.5 : pi / (pCount - 1);
      const pAngle = sectorMid + (pFrac - 0.5) * 2 * sectorHalf;
      if (!placed.has(pid) && !subjects.has(pid)) {
        setPos(pid, Math.cos(pAngle) * r2, Math.sin(pAngle) * r2, 2);
      }

      const objIds = Array.from(preds.get(pid));
      const oCount = objIds.length || 1;
      const oHalf = (sectorHalf / pCount) * 0.85;
      objIds.forEach((oid, oi) => {
        if (placed.has(oid) || subjects.has(oid)) return;
        const oFrac = oCount === 1 ? 0.5 : oi / (oCount - 1);
        const oAngle = pAngle + (oFrac - 0.5) * 2 * oHalf;
        setPos(oid, Math.cos(oAngle) * r3, Math.sin(oAngle) * r3, 3);
      });
    });
  });

  // Any node still unplaced parks on the ring for its primary level.
  let leftover = 0;
  const unplacedCount = nodes.filter((n) => !placed.has(n.id)).length || 1;
  nodes.forEach((n) => {
    if (placed.has(n.id)) return;
    const lvl = levelOf.get(n.id) || 3;
    const radius = lvl === 1 ? innerR : lvl === 2 ? r2 : r3;
    const ang = (leftover / unplacedCount) * Math.PI * 2;
    leftover += 1;
    setPos(n.id, Math.cos(ang) * radius, Math.sin(ang) * radius, lvl);
  });

  return { subjects, levelOf, r1: innerR, r2, r3, sCount };
};

// Pin (or seed) the radial positions onto nodes. With `pin:true` we set fx/fy so
// the layout is fixed and legible; a user drag later overrides via __userPinned.
export const applyRadialPositions = (nodes, { pin = true } = {}) => {
  nodes.forEach((n) => {
    if (n.__radX == null || n.__radY == null) return;
    n.x = n.__radX;
    n.y = n.__radY;
    if (pin && !n.__userPinned) {
      n.fx = n.__radX;
      n.fy = n.__radY;
    }
    // Tag subject hubs as anchors so the existing LOD/label path treats them as
    // the "universe" hubs (big, always-labelled).
    n.isAnchor = n.__radLevel === 1;
  });
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
