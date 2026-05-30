// src/graphData.js
import { getNodeColor, getPredicateColor } from "./nodeColors";

// Transform raw triples (subject -> predicate -> object) into force-graph data
// under the PREDICATE-AS-EDGE model:
//
//   * Nodes are ONLY the distinct subject and object atoms. A predicate is a
//     relationship CATEGORY, not a node — it is rendered as the colored,
//     labeled EDGE between a subject and an object.
//   * One link per triple: subject -> object, carrying the predicate label,
//     predicateId and a stable per-predicate color. The same object reached by
//     many subjects is a SINGLE shared node (a popular leaf many branches hit);
//     we never duplicate it.
//   * An atom that is a subject in one triple and an object in another is one
//     node. Its primary level is: ever-a-subject -> level 1 (center hub), else
//     object -> level 2 (outer leaf).
//
// Every node keeps the metadata the visualization needs:
//   - `roles`  (Set of "subject"/"object") + `role` (primary)
//   - `triples` (the {subject,predicate,object} it participates in) for the
//     contextual hover tooltip
//   - `predicateGroups` / `subjectGroups` cluster keys (kept for layout helpers)
export const transformToGraphData = (triples) => {
  const nodes = [];
  const links = [];
  const nodeMap = new Map();
  // Track distinct predicates so callers (filter UI) can list categories.
  const predicates = new Map(); // predicateId -> { id, label, color }

  const ensureNode = (entity, role) => {
    if (!entity) return null;
    let node = nodeMap.get(entity.id);
    if (!node) {
      node = {
        id: entity.id,
        label: entity.label,
        type: entity.type,
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
      // Subject wins as the primary role/color: a node ever used as a subject is
      // a center hub; an object-only node is an outer leaf.
      if (role === "subject") {
        node.color = getNodeColor("subject");
        node.role = "subject";
      }
    }
    return node;
  };

  triples.forEach((triple) => {
    const { subject, predicate, object } = triple;
    if (!subject || !predicate || !object) return;

    const sNode = ensureNode(subject, "subject");
    const oNode = ensureNode(object, "object");

    const color = getPredicateColor(predicate.id);
    if (!predicates.has(predicate.id)) {
      predicates.set(predicate.id, {
        id: predicate.id,
        label: predicate.label,
        color,
      });
    }

    // Record triple membership + cluster keys on the participating atoms.
    [sNode, oNode].forEach((n) => {
      if (!n) return;
      n.triples.push({ subject, predicate, object });
      n.predicateGroups.add(predicate.id);
      n.subjectGroups.add(subject.id);
    });

    // ONE predicate-colored edge per triple: subject -> object.
    links.push({
      source: subject.id,
      target: object.id,
      type: "predicate-edge",
      predicate: predicate.label,
      predicateId: predicate.id,
      subjectId: subject.id,
      objectId: object.id,
      color,
    });
  });

  return { nodes, links, predicates: Array.from(predicates.values()) };
};
