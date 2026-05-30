// src/nodeColors.js

// Node color definitions. In the predicate-as-edge model nodes are only the
// subject and object atoms; predicates are colored EDGES (see PREDICATE_PALETTE).
export const NODE_COLORS = {
  SUBJECT: "#4361EE", // Vibrant blue for subjects (inner-ring hubs)
  OBJECT: "#9D4EDD", // Rich purple for objects (outer-ring leaves)
  CREATOR: "#00FF00", // Green for creators
};

// Helper function to get node color based on role
export const getNodeColor = (role) => {
  switch (role) {
    case "subject":
      return NODE_COLORS.SUBJECT;
    case "object":
      return NODE_COLORS.OBJECT;
    case "creator":
      return NODE_COLORS.CREATOR;
    default:
      return NODE_COLORS.SUBJECT;
  }
};

// ---- Predicate (edge) color palette -----------------------------------------
// Mainnet has only ~12 distinct predicates, so a fixed, high-contrast palette
// lets every relationship category read as a distinctly colored branch. Colors
// are assigned deterministically per predicate id (stable across renders) and
// reused by the predicate filter chips so chip color == branch color.
export const PREDICATE_PALETTE = [
  "#FF7300", // orange
  "#27D3C4", // teal
  "#F2C14E", // amber
  "#E5446D", // rose
  "#54C45E", // green
  "#A66BFF", // violet
  "#3DA5FF", // sky
  "#FF8FB1", // pink
  "#C0CA33", // lime
  "#FF5252", // red
  "#26A69A", // sea green
  "#B388FF", // lavender
  "#FFB300", // gold
  "#7E57C2", // deep purple
  "#00BCD4", // cyan
  "#8D6E63", // brown
];

// Deterministic id -> palette index. Keeps the same predicate the same color
// regardless of iteration order across graph rebuilds (trust subgraphs etc.).
const hashKey = (key) => {
  const s = String(key);
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
};

export const getPredicateColor = (predicateId) =>
  PREDICATE_PALETTE[hashKey(predicateId) % PREDICATE_PALETTE.length];
