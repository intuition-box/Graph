// src/graphData.js
import { getNodeColor } from "./nodeColors";

// Transform raw triples (subject -> predicate -> object) into force-graph data.
//
// Each node is annotated with the triple-membership metadata the visualization
// needs for two features:
//   - clustering: `predicateGroups` / `subjectGroups` (the cluster keys this
//     node belongs to) so a cluster force can pull it toward a centroid.
//   - contextual hover: `triples` (the {subject,predicate,object} triples this
//     node participates in) so the tooltip can show the relevant connection(s).
// A single atom can play different roles across triples (subject here, object
// there), so we accumulate a Set of roles and the list of triples.
export const transformToGraphData = (triples) => {
  const nodes = [];
  const links = [];
  const nodeMap = new Map();

  const ensureNode = (entity, role) => {
    if (!entity) return null;
    let node = nodeMap.get(entity.id);
    if (!node) {
      node = {
        id: entity.id,
        label: entity.label,
        isTriple: false,
        color: getNodeColor(role),
        role,
        roles: new Set([role]),
        triples: [],
        predicateGroups: new Set(),
        subjectGroups: new Set(),
      };
      nodeMap.set(entity.id, node);
      nodes.push(node);
    } else {
      node.roles.add(role);
      // A predicate that is also seen as a subject elsewhere keeps its predicate
      // colour (predicates are the most useful anchors); otherwise first role wins.
      if (role === "predicate") {
        node.color = getNodeColor("predicate");
        node.role = "predicate";
      }
    }
    return node;
  };

  triples.forEach((triple) => {
    const { subject, predicate, object } = triple;
    if (!subject || !predicate || !object) return;

    const sNode = ensureNode(subject, "subject");
    const pNode = ensureNode(predicate, "predicate");
    const oNode = ensureNode(object, "object");

    // Record triple membership + cluster keys on every participating node.
    [sNode, pNode, oNode].forEach((n) => {
      if (!n) return;
      n.triples.push({ subject, predicate, object });
      n.predicateGroups.add(predicate.id);
      n.subjectGroups.add(subject.id);
    });

    links.push({
      source: subject.id,
      target: predicate.id,
      type: "subject-to-predicate",
      predicateId: predicate.id,
      subjectId: subject.id,
    });
    links.push({
      source: predicate.id,
      target: object.id,
      type: "predicate-to-object",
      predicateId: predicate.id,
      subjectId: subject.id,
    });
  });

  return { nodes, links };
};
