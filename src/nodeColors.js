// src/nodeColors.js

// Node color definitions
export const NODE_COLORS = {
  SUBJECT: "#A259FF", // Jaune Agent
  PREDICATE: "#FFD32A", // Violet
  OBJECT: "#3ED598", // Vert
  CREATOR: "#2196F3", // Bleu pour Creator
};

// Helper function to get node color based on role
export const getNodeColor = (role) => {
  switch (role) {
    case "subject":
      return NODE_COLORS.SUBJECT;
    case "predicate":
      return NODE_COLORS.PREDICATE;
    case "object":
      return NODE_COLORS.OBJECT;
    case "creator":
      return NODE_COLORS.CREATOR;
    default:
      return "#444"; // Gris par défaut pour les autres
  }
};
