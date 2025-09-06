import React from 'react';
import { REALITY_TUNNEL_WHITELIST } from './realityTunnelConfig';

const EyeIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 5C7 5 2.73 8.11 1 12c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" fill="#fff"/>
  </svg>
);

// A centered control to pick which address' positions to visualize
export default function RealityTunnel({ value, onChange, connectedAddress, connectedLabel }) {
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

  return (
    <div className="header-center" title="Filter graph by address positions">
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
    </div>
  );
}

