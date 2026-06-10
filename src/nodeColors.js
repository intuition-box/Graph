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

// ---- Atom-type colors + shapes (Focus mode) ---------------------------------
// The Arkham-style Focus view colors and shapes each node by its ATOM TYPE
// (Account/Person/Thing/Claim/...) rather than its subject/object role, so the
// type of each entity is readable at a glance. Unknown/absent types fall back to
// a neutral default. Keys are matched case-insensitively against atom.type.
export const TYPE_STYLES = {
  account: { color: "#3DA5FF", shape: "diamond", label: "Account" },
  person: { color: "#54C45E", shape: "circle", label: "Person" },
  organization: { color: "#27D3C4", shape: "square", label: "Organization" },
  thing: { color: "#A66BFF", shape: "circle", label: "Thing" },
  book: { color: "#F2C14E", shape: "square", label: "Book" },
  claim: { color: "#E5446D", shape: "triangle", label: "Claim" },
  triple: { color: "#FF7300", shape: "triangle", label: "Triple" },
  atom: { color: "#9D4EDD", shape: "circle", label: "Atom" },
  default: { color: "#8A93A6", shape: "circle", label: "Other" },
};

// Resolve an atom type string to a { color, shape, label } style. Robust to
// casing and to null/undefined types (returns the neutral default).
export const getTypeStyle = (type) => {
  const key = String(type || "").toLowerCase();
  return TYPE_STYLES[key] || TYPE_STYLES.default;
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
