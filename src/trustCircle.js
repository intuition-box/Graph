// src/trustCircle.js
//
// Data layer for the wallet-personalized "Reality Tunnel" trust circle.
//
// Intuition is permissionless: there is no single canonical "trust" or
// "follows" predicate atom (mainnet has multiple independently-created atoms
// labeled "trusts"/"follows"). The structural signal that actually exists at
// volume is: a triple whose subject is the connected wallet's Account atom
// and whose object is another Account atom — i.e. "this wallet made an
// on-chain claim about that wallet", backed by a real vault position. That is
// what this module treats as a "trust circle" edge.
import { transformToGraphData } from "./graphData";

const CURVE_ID = "1";

const ACCOUNT_ATOM_QUERY = `
  query TrustCircleAccountAtom($address: String!) {
    accounts(where: { id: { _ilike: $address } }, limit: 1) {
      id
      label
      atom_id
    }
  }
`;

const OUTBOUND_ACCOUNT_TRIPLES_QUERY = `
  query TrustCircleOutboundTriples($atomId: numeric!, $viewer: String!) {
    triples(
      where: { subject_id: { _eq: $atomId }, object: { type: { _eq: "Account" } } }
    ) {
      term_id
      predicate {
        term_id
        label
      }
      object {
        term_id
        label
        wallet_id
      }
      term {
        vaults(where: { curve_id: { _eq: "${CURVE_ID}" } }) {
          total_shares
          positions(where: { account_id: { _ilike: $viewer } }) {
            shares
          }
        }
      }
    }
  }
`;

// Resolve a wallet address to its Account atom (the node representing that
// wallet in the knowledge graph). Returns null if the address has no atom yet
// (e.g. it has never interacted with the protocol).
export async function resolveAccountAtom(client, address) {
  if (!address) return null;
  const data = await client.request(ACCOUNT_ATOM_QUERY, { address });
  const account = data?.accounts?.[0];
  if (!account || !account.atom_id) return null;
  return {
    address: account.id,
    label: account.label || account.id,
    atomId: account.atom_id,
  };
}

// Fetch the on-chain claims `rootAddress` has made about other accounts
// (the outbound edges of its trust circle), with stake-based weighting.
export async function fetchOutboundTrustEdges(client, atomId, rootAddress) {
  const data = await client.request(OUTBOUND_ACCOUNT_TRIPLES_QUERY, {
    atomId,
    viewer: rootAddress,
  });
  const triples = data?.triples || [];
  return triples
    .map((t) => {
      const vault = t.term?.vaults?.[0];
      const totalShares = Number(vault?.total_shares || 0);
      const ownShares = Number(vault?.positions?.[0]?.shares || 0);
      return {
        id: t.term_id,
        predicateLabel: t.predicate?.label || "is related to",
        target: {
          atomId: t.object?.term_id || null,
          address: t.object?.wallet_id || null,
          label: t.object?.label || t.object?.wallet_id || "Unknown",
        },
        totalShares,
        ownShares,
        // Prefer the stake the root account itself put behind the claim;
        // fall back to the vault's total shares so unstaked claims still
        // render with some weight rather than collapsing to zero.
        weight: ownShares > 0 ? ownShares : totalShares,
      };
    })
    .filter((edge) => edge.target.address);
}

// Turn trust-circle edges rooted at `root` into the {subject, predicate,
// object} triple shape `transformToGraphData` already understands, carrying
// the edge weight along for downstream node/link sizing.
export function edgesToTriples(root, edges) {
  return edges.map((edge) => ({
    id: edge.id,
    subject: { id: root.address, label: root.label },
    predicate: { id: `${edge.id}-predicate`, label: edge.predicateLabel },
    object: { id: edge.target.address, label: edge.target.label },
    weight: edge.weight,
  }));
}

// Apply weight-derived `val` (node size) and `width` (link size) to graph
// data produced by transformToGraphData, so stake/attestation strength is
// visible. Falls back to 1 for anything we have no weight for.
function applyWeighting(graphData, triples) {
  const weightByObjectId = new Map();
  triples.forEach((t) => {
    const prev = weightByObjectId.get(t.object.id) || 0;
    weightByObjectId.set(t.object.id, Math.max(prev, t.weight || 0));
  });
  const maxWeight = Math.max(1, ...weightByObjectId.values());

  const nodes = graphData.nodes.map((node) => {
    const raw = weightByObjectId.get(node.id);
    if (raw === undefined) return node;
    const normalized = 1 + 4 * Math.sqrt(raw / maxWeight);
    return { ...node, val: normalized };
  });

  const weightByTripleId = new Map(triples.map((t) => [t.id, t.weight || 0]));
  const tripleIdFromPredicateNodeId = (predicateNodeId) =>
    String(predicateNodeId).replace(/-predicate$/, "");

  const links = graphData.links.map((link) => {
    let tripleId = null;
    if (link.type === "subject-to-predicate") tripleId = tripleIdFromPredicateNodeId(link.target);
    else if (link.type === "predicate-to-object") tripleId = tripleIdFromPredicateNodeId(link.source);

    const raw = tripleId ? weightByTripleId.get(tripleId) : undefined;
    if (raw === undefined) return link;
    const normalized = 1 + 3 * Math.sqrt(raw / maxWeight);
    return { ...link, width: normalized };
  });

  return { nodes, links };
}

// Build render-ready graph data (nodes/links with weight-derived sizing)
// from a flat list of trust-circle triples, regardless of how many roots
// they came from (single-perspective or aggregated).
export function buildGraphFromTriples(triples) {
  const base = transformToGraphData(triples);
  return applyWeighting(base, triples);
}

// Build render-ready graph data for a single root's outbound trust circle.
export function buildTrustCircleGraph(root, edges) {
  return buildGraphFromTriples(edgesToTriples(root, edges));
}

// "All trust circle": root's own outbound edges, plus one more hop — the
// outbound edges of everyone in root's circle — merged into one graph.
export async function fetchAggregatedTrustCircle(client, rootAddress) {
  const root = await resolveAccountAtom(client, rootAddress);
  if (!root) return { root: null, triples: [], edgeCount: 0 };

  const rootEdges = await fetchOutboundTrustEdges(client, root.atomId, root.address);
  const allTriples = edgesToTriples(root, rootEdges);

  const hopTriples = await Promise.all(
    rootEdges.map(async (edge) => {
      if (!edge.target.atomId) return [];
      const peer = {
        address: edge.target.address,
        label: edge.target.label,
        atomId: edge.target.atomId,
      };
      try {
        const peerEdges = await fetchOutboundTrustEdges(client, peer.atomId, peer.address);
        return edgesToTriples(peer, peerEdges);
      } catch (e) {
        console.error("Error fetching second-hop trust edges for", peer.address, e);
        return [];
      }
    })
  );

  hopTriples.forEach((triples) => allTriples.push(...triples));

  return { root, rootEdges, triples: allTriples, edgeCount: rootEdges.length };
}
