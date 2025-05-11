// src/nodeColors.js

// Node color definitions
export const NODE_COLORS = {
  SUBJECT: "#FFB300", // Jaune/orangé accessible
  PREDICATE: "#1976D2", // Bleu profond accessible
  OBJECT: "#43A047", // Vert foncé accessible
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
    default:
      return "#444"; // Gris par défaut pour les autres
  }
};
