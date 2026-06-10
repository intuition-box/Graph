// src/trustCircle.js
// A user's "trust circle" = the Account-type atoms they hold positions on
// (accounts they've staked on), derived from on-chain positions. Each member is
// weighted by vault shares (stake = trust strength).
//
// Verified against mainnet (https://mainnet.intuition.sh/v1/graphql):
//   account(id: $address) {
//     positions(where: {vault: {term: {atom: {type: {_eq: "Account"}}}}}) {
//       shares
//       vault { term { atom { term_id label wallet_id } } }
//     }
//   }
// The Account atom's `wallet_id` is the on-chain address of the trusted account,
// which is what the graph filter matches positions against.
import { createClient } from "./api";

const TRUST_CIRCLE_QUERY = `
  query TrustCircle($address: String!, $limit: Int) {
    account(id: $address) {
      id
      label
      positions(
        where: { vault: { term: { atom: { type: { _eq: "Account" } } } } }
        order_by: { shares: desc }
        limit: $limit
      ) {
        shares
        vault {
          term {
            atom {
              term_id
              label
              wallet_id
            }
          }
        }
      }
    }
  }
`;

// Returns: [{ address, atomId, label, weight }] sorted by weight desc.
// `address` is the trusted account's wallet address (used to filter the graph).
// `weight` is the bigint share string aggregated across that account's vault(s).
export const fetchTrustCircle = async (address, endpoint = "base") => {
  if (!address) return [];
  const client = createClient(endpoint);
  // CRITICAL: pass `address` AS-IS. Intuition mainnet account ids are
  // checksum-cased — account(id:"0x34E3...F1A6") resolves, but the lowercased id
  // returns null. Never `.toLowerCase()` the id handed to account(id:).
  const data = await client.request(TRUST_CIRCLE_QUERY, { address, limit: 200 });
  const positions = data?.account?.positions || [];

  const byAddress = new Map();
  for (const pos of positions) {
    const atom = pos?.vault?.term?.atom;
    if (!atom) continue;
    const walletId = atom.wallet_id;
    if (!walletId) continue;
    const key = walletId.toLowerCase();
    const parsed = Number(pos.shares);
    const shares = Number.isFinite(parsed) ? parsed : 0;
    const existing = byAddress.get(key);
    if (existing) {
      existing.weight += shares;
    } else {
      byAddress.set(key, {
        address: walletId,
        atomId: atom.term_id,
        label: atom.label || walletId,
        weight: shares,
      });
    }
  }

  return Array.from(byAddress.values()).sort((a, b) => b.weight - a.weight);
};

// The mainnet Hasura caps every list query at 250 rows, so each sub-query below
// is naturally bounded — even a 35k-position account returns at most 250+250
// triples, ranked by total_market_cap so the most-staked claims come first.
const TRUST_GRAPH_QUERY = `
  query TrustGraph($atomIds: [String!]!, $addresses: [String!]!, $limit: Int) {
    about: triples(
      where: {
        _or: [
          { subject_id: { _in: $atomIds } }
          { object_id: { _in: $atomIds } }
        ]
      }
      order_by: { term: { total_market_cap: desc } }
      limit: $limit
    ) {
      term_id
      subject_id
      object_id
      subject { term_id label type }
      predicate { term_id label type }
      object { term_id label type }
    }
    staked: triples(
      where: {
        _or: [
          { term: { vaults: { positions: { account_id: { _in: $addresses } } } } }
          { counter_term: { vaults: { positions: { account_id: { _in: $addresses } } } } }
        ]
      }
      order_by: { term: { total_market_cap: desc } }
      limit: $limit
    ) {
      term_id
      subject { term_id label type }
      predicate { term_id label type }
      object { term_id label type }
      term {
        vaults { positions(where: { account_id: { _in: $addresses } }) { shares } }
      }
      counter_term {
        vaults { positions(where: { account_id: { _in: $addresses } }) { shares } }
      }
    }
  }
`;

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Fetch the trust-tunnel subgraph for a set of circle members:
//   * `about`  — claims whose subject/object IS a member's Account atom,
//     weighted by the viewer's stake on that member (attestation strength).
//   * `staked` — claims the members (and optionally the viewer, for the
//     aggregate mode) hold positions on, weighted by those vault shares.
// `_in` on account_id is case-sensitive, so every address is sent in both its
// original (checksummed) and lowercased form.
// Returns { triples, weights, counts } with triples deduped across sub-queries.
export const fetchTrustGraph = async (
  members,
  { selfAddress = null, endpoint = "base", limit = 250 } = {}
) => {
  const atomIds = [...new Set(members.map((m) => m.atomId).filter(Boolean))];
  const withVariants = (a) => [a, String(a).toLowerCase()];
  const addresses = [
    ...new Set([
      ...members.flatMap((m) => withVariants(m.address)),
      ...(selfAddress ? withVariants(selfAddress) : []),
    ]),
  ];

  const client = createClient(endpoint);
  const data = await client.request(TRUST_GRAPH_QUERY, {
    atomIds,
    addresses,
    limit,
  });

  const atomWeight = new Map();
  members.forEach((m) => {
    if (m.atomId) atomWeight.set(m.atomId, m.weight || 0);
  });

  const mapEntity = (e) =>
    e ? { id: e.term_id, label: e.label, type: e.type } : null;
  const triples = new Map();
  const weights = {};
  const addWeight = (id, w) => {
    weights[id] = (weights[id] || 0) + w;
  };
  let positions = 0;

  (data?.about || []).forEach((t) => {
    const triple = {
      id: t.term_id,
      subject: mapEntity(t.subject),
      predicate: mapEntity(t.predicate),
      object: mapEntity(t.object),
    };
    if (!triple.subject || !triple.predicate || !triple.object) return;
    if (!triples.has(triple.id)) triples.set(triple.id, triple);
    [t.subject_id, t.object_id].forEach((aid) => {
      if (atomWeight.has(aid)) addWeight(triple.id, atomWeight.get(aid));
    });
  });

  const sideShares = (side) => {
    let total = 0;
    (side?.vaults || []).forEach((v) => {
      (v.positions || []).forEach((p) => {
        positions += 1;
        total += toNum(p?.shares);
      });
    });
    return total;
  };

  (data?.staked || []).forEach((t) => {
    const triple = {
      id: t.term_id,
      subject: mapEntity(t.subject),
      predicate: mapEntity(t.predicate),
      object: mapEntity(t.object),
    };
    if (!triple.subject || !triple.predicate || !triple.object) return;
    if (!triples.has(triple.id)) triples.set(triple.id, triple);
    addWeight(triple.id, sideShares(t.term) + sideShares(t.counter_term));
  });

  return {
    triples: Array.from(triples.values()),
    weights,
    counts: {
      about: (data?.about || []).length,
      staked: (data?.staked || []).length,
      positions,
    },
  };
};
