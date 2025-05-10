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

    // Create or update predicate node
    if (!nodeMap.has(predicate.id)) {
      const predicateNode = {
        id: predicate.id,
        label: predicate.label,
        isTriple: false,
        color: getNodeColor("predicate"),
        type: "predicate",
      };
      nodeMap.set(predicate.id, predicateNode);
      nodes.push(predicateNode);
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

    // Create links
    links.push({
      source: subject.id,
      target: predicate.id,
      type: "subject-to-predicate",
    });
    links.push({
      source: predicate.id,
      target: object.id,
      type: "predicate-to-object",
    });
  });

  return { nodes, links };
};
