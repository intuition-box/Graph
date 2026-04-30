import React from 'react';
import { REALITY_TUNNEL_WHITELIST } from './realityTunnelConfig';

const EyeIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 5C7 5 2.73 8.11 1 12c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" fill="#fff"/>
  </svg>
);

const TrustIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2Z" fill="none" stroke="#22c55e" strokeWidth="2"/>
    <path d="M9 12l2 2 4-4" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/**
 * Reality Tunnel — trust-weighted graph filter.
 *
 * Props:
 *  value               {string|null}  - currently selected address filter
 *  onChange            {fn}           - called with address string or null
 *  connectedAddress    {string|null}  - wallet address from wagmi
 *  connectedLabel      {string}       - human-readable wallet label
 *  trustThreshold      {number}       - current trust threshold (0–100, % of max vault shares)
 *  onTrustThresholdChange {fn}        - called with new threshold value (number)
 */
export default function RealityTunnel({
  value,
  onChange,
  connectedAddress,
  connectedLabel,
  trustThreshold = 0,
  onTrustThresholdChange,
}) {
  const options = React.useMemo(() => {
    const list = [];
    if (connectedAddress) {
      list.push({ label: connectedLabel || 'My Wallet', address: connectedAddress });
    }
    for (const item of REALITY_TUNNEL_WHITELIST) {
      // de-duplicate by address
      if (!list.find((x) => x.address.toLowerCase() === item.address.toLowerCase())) {
        list.push({ label: item.label || item.address, address: item.address });
      }
    }
    return list;
  }, [connectedAddress, connectedLabel]);

  const handleThresholdChange = React.useCallback((e) => {
    const val = Number(e.target.value);
    if (onTrustThresholdChange) onTrustThresholdChange(val);
  }, [onTrustThresholdChange]);

  return (
    <div className="header-center" title="Filter graph by address positions and trust weight">
      {/* Address selector */}
      <div className="tunnel">
        <EyeIcon />
        <span className="tunnel-label">Reality Tunnel</span>
        <select
          className="tunnel-select"
          value={value || ''}
          onChange={(e) => onChange && onChange(e.target.value || null)}
        >
          {options.length === 0 && <option value="">Select address</option>}
          {options.map((opt) => (
            <option key={opt.address} value={opt.address}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Trust Threshold slider */}
      <div className="trust-threshold" title="Filter edges by minimum $TRUST staked (vault shares)">
        <TrustIcon />
        <span className="tunnel-label">Trust&nbsp;≥</span>
        <input
          type="range"
          className="trust-slider"
          min={0}
          max={100}
          step={1}
          value={trustThreshold}
          onChange={handleThresholdChange}
          aria-label="Minimum trust threshold"
        />
        <span className="trust-value">{trustThreshold}%</span>
      </div>
    </div>
  );
}

/**
 * filterGraphByTrust — pure helper for GraphVisualization to consume.
 *
 * Filters nodes and links so only those with vault share weight >= threshold
 * (expressed as a % of the max observed total_shares) survive.
 *
 * @param {{ nodes: Array, links: Array }} graphData
 * @param {number} thresholdPct  0 = show all, 100 = only max-weight edges
 * @returns {{ nodes: Array, links: Array }}
 */
export function filterGraphByTrust(graphData, thresholdPct = 0) {
  if (!graphData || thresholdPct === 0) return graphData;

  const { nodes, links } = graphData;

  // Find the max vault shares across all nodes
  const maxShares = nodes.reduce((max, n) => {
    const s = n.vault?.total_shares ?? n.totalShares ?? 0;
    return Math.max(max, Number(s));
  }, 0);

  if (maxShares === 0) return graphData;

  const minShares = (thresholdPct / 100) * maxShares;

  // Filter nodes that meet the trust threshold
  const acceptedIds = new Set(
    nodes
      .filter((n) => {
        const s = n.vault?.total_shares ?? n.totalShares ?? 0;
        return Number(s) >= minShares;
      })
      .map((n) => n.id)
  );

  // Filter links where both endpoints survive
  const filteredLinks = links.filter(
    (l) => acceptedIds.has(l.source?.id ?? l.source) && acceptedIds.has(l.target?.id ?? l.target)
  );

  // Re-filter nodes to only those still referenced by surviving links
  const linkedIds = new Set();
  filteredLinks.forEach((l) => {
    linkedIds.add(l.source?.id ?? l.source);
    linkedIds.add(l.target?.id ?? l.target);
  });

  const filteredNodes = nodes.filter((n) => linkedIds.has(n.id));

  return { nodes: filteredNodes, links: filteredLinks };
}
