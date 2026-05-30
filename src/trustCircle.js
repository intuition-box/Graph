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
