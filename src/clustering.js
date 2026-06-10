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

// ---- Radial 2-level "branch" layout (subject -> object, predicate = edge) ----
//
// Predicate-as-edge model: nodes are only subjects and objects. The user's
// vision: subject atoms on an inner ring at the CENTER, and each subject's
// objects fanned out as LEAVES in that subject's own angular wedge at an outer
// radius. The predicate-colored EDGE from subject to object IS the branch.
//
// PRIMARY LEVEL per node (a node can be a subject in one triple, object in
// another):
//   - ever a subject -> level 1 (center hub)
//   - else (object)  -> level 2 (outer leaf)
//
// Every subject owns an angular SECTOR; its objects fan across that sector. A
// shared object (reached by many subjects) is positioned ONCE under the first
// subject that claims it — the other subjects' colored edges still draw to it,
// so a popular leaf reads as a hub where many branches converge.
//
// Returns { subjects, levelOf, r1, r2, sCount } so the renderer can treat
// subject hubs as the "anchors" for level-of-detail + labelling.
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
    } else {
      levelOf.set(n.id, 2);
    }
  });

  // 2) Build per-subject object lists from the predicate edges. Order objects
  //    by predicate so same-predicate branches sit together inside the wedge.
  //    subjectTree: Map<subjectId, ordered Array<objectId>>
  const subjectTree = new Map();
  const seenPerSubject = new Map();
  const ensure = (sid) => {
    if (!subjectTree.has(sid)) {
      subjectTree.set(sid, []);
      seenPerSubject.set(sid, new Set());
    }
    return subjectTree.get(sid);
  };
  const grouped = new Map(); // sid -> Map<predicateId, objectId[]>
  links.forEach((l) => {
    const sid = typeof l.source === "object" ? l.source.id : l.source;
    const oid = typeof l.target === "object" ? l.target.id : l.target;
    if (sid == null || !subjects.has(sid) || oid == null) return;
    if (!grouped.has(sid)) grouped.set(sid, new Map());
    const g = grouped.get(sid);
    const pid = l.predicateId != null ? l.predicateId : "_";
    if (!g.has(pid)) g.set(pid, []);
    g.get(pid).push(oid);
  });
  grouped.forEach((g, sid) => {
    const arr = ensure(sid);
    const seen = seenPerSubject.get(sid);
    g.forEach((oids) => {
      oids.forEach((oid) => {
        if (seen.has(oid)) return;
        seen.add(oid);
        arr.push(oid);
      });
    });
  });
  // Ensure every subject has an entry even if it had no outgoing edges.
  subjects.forEach((sid) => ensure(sid));

  const subjectIds = Array.from(subjectTree.keys());
  const sCount = subjectIds.length || 1;

  // Inner ring sized from desired arc-spacing between hubs so they don't blob:
  //   circumference = sCount * HUB_GAP -> innerR = sCount * HUB_GAP / (2π)
  // HUB_GAP is generous so the hub ring is a clear circle of separate dots even
  // with 200+ subjects (the convergent mainnet graph), not a solid band.
  const HUB_GAP = 120; // target arc distance between adjacent subject hubs
  const innerR =
    opts.r1 != null
      ? opts.r1
      : sCount <= 1
      ? 0
      : Math.max(220, (sCount * HUB_GAP) / (2 * Math.PI));

  const placed = new Set();
  const setPos = (id, x, y, level) => {
    const node = byId.get(id);
    if (!node) return;
    node.__radX = x;
    node.__radY = y;
    node.__radLevel = level;
    placed.add(id);
  };

  // Each subject's objects sit on a SHORT outward spoke just past the hub ring,
  // fanned within a tight wedge centered on the subject's angle. Short spokes
  // keep each subject's branch fan local and legible; a shared object is placed
  // once (under its first subject) and the other subjects' colored edges draw to
  // it as chords — the real convergent structure, but the dominant read is each
  // hub's own little outward fan rather than one giant tangle.
  // Spoke length scales with how many objects a subject owns so dense fans get
  // a little more room, but stays a fraction of the hub ring so it reads local.
  subjectIds.forEach((sid, si) => {
    const sectorMid = ((si + 0.5) / sCount) * Math.PI * 2;
    // Wedge half-angle: keep object fans narrow so spokes point outward, not
    // sideways into neighbours. Capped so even sparse graphs don't fan too wide.
    const sectorHalf = Math.min((Math.PI / sCount) * 0.8, 0.22);

    if (sCount === 1) setPos(sid, 0, 0, 1);
    else
      setPos(sid, Math.cos(sectorMid) * innerR, Math.sin(sectorMid) * innerR, 1);

    const objIds = subjectTree
      .get(sid)
      .filter((oid) => !placed.has(oid) && !subjects.has(oid));
    const oCount = objIds.length || 1;
    const spoke = Math.max(120, innerR * 0.22);
    objIds.forEach((oid, oi) => {
      const oFrac = oCount === 1 ? 0.5 : oi / (oCount - 1);
      const oAngle = sectorMid + (oFrac - 0.5) * 2 * sectorHalf;
      // Stagger objects along the spoke so same-angle leaves don't overlap.
      const depth = spoke * (1 + (oi % 3) * 0.28);
      const leafR = innerR + depth;
      setPos(oid, Math.cos(oAngle) * leafR, Math.sin(oAngle) * leafR, 2);
    });
  });

  const r2 = innerR + Math.max(120, innerR * 0.22);

  // Any node still unplaced parks on the ring for its primary level.
  let leftover = 0;
  const unplacedCount = nodes.filter((n) => !placed.has(n.id)).length || 1;
  nodes.forEach((n) => {
    if (placed.has(n.id)) return;
    const lvl = levelOf.get(n.id) || 2;
    const radius = lvl === 1 ? innerR : r2;
    const ang = (leftover / unplacedCount) * Math.PI * 2;
    leftover += 1;
    setPos(n.id, Math.cos(ang) * radius, Math.sin(ang) * radius, lvl);
  });

  return { subjects, levelOf, r1: innerR, r2, sCount };
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
