// src/graphData.js
import { getNodeColor } from "./nodeColors";

export const transformToGraphData = (triples) => {
  const nodes = [];
  const links = [];
  const nodeMap = new Map();

  // Process triples to create nodes and links
  triples.forEach(({ subject, predicate, object }) => {
    // Create or update subject node
    if (!nodeMap.has(subject.id)) {
      const subjectNode = {
        id: subject.id,
        label: subject.label,
        isTriple: false,
        color: getNodeColor("subject"),
        type: "subject",
      };
      nodeMap.set(subject.id, subjectNode);
      nodes.push(subjectNode);
    }

    // Create or update object node
    if (!nodeMap.has(object.id)) {
      const objectNode = {
        id: object.id,
        label: object.label,
        isTriple: false,
        color: getNodeColor("object"),
        type: "object",
      };
      nodeMap.set(object.id, objectNode);
      nodes.push(objectNode);
    }

    // Créer un lien direct du sujet à l'objet, avec le label du prédicat
    links.push({
      source: subject.id,
      target: object.id,
      type: "subject-to-object",
      label: predicate.label,
      predicateId: predicate.id,
    });
  });

  return { nodes, links };
};
