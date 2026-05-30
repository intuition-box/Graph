import React from 'react';
import { fetchTrustCircle } from './trustCircle';

const EyeIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 5C7 5 2.73 8.11 1 12c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" fill="#fff"/>
  </svg>
);

const MODES = [
  { key: 'global', label: 'Global' },
  { key: 'mine', label: 'My circle' },
  { key: 'single', label: 'Single' },
  { key: 'all', label: 'All circle' },
];

// Trust-circle-driven graph filter. Three trust modes (plus the default global
// view) built from the connected wallet's on-chain trust circle.
export default function RealityTunnel({
  connectedAddress,
  connectedLabel,
  endpoint,
  onChange,
}) {
  const [mode, setMode] = React.useState('global');
  const [circle, setCircle] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [singleAddress, setSingleAddress] = React.useState('');

  // Load the trust circle whenever the connected wallet (or endpoint) changes.
  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!connectedAddress) {
        setCircle([]);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const members = await fetchTrustCircle(connectedAddress, endpoint);
        if (!cancelled) {
          setCircle(members);
          setSingleAddress((prev) =>
            prev && members.find((m) => m.address.toLowerCase() === prev.toLowerCase())
              ? prev
              : (members[0]?.address || '')
          );
        }
      } catch (e) {
        if (!cancelled) setError('Failed to load trust circle');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [connectedAddress, endpoint]);

  // Emit the active selection to the parent whenever inputs change.
  React.useEffect(() => {
    if (!onChange) return;
    if (mode === 'global' || !connectedAddress) {
      onChange({ mode: 'global' });
      return;
    }
    if (mode === 'single') {
      onChange({ mode: 'single', singleAddress: singleAddress || null });
      return;
    }
    // mine / all: aggregate across the trust circle. "all" also includes the
    // connected wallet's own positions for the fullest perspective.
    const addresses = circle.map((m) => m.address);
    const weights = {};
    circle.forEach((m) => { weights[m.address.toLowerCase()] = m.weight; });
    onChange({
      mode,
      addresses: mode === 'all' ? [...addresses, connectedAddress] : addresses,
      weights,
    });
  }, [mode, singleAddress, circle, connectedAddress, onChange]);

  const hint = (() => {
    if (!connectedAddress) return 'Connect wallet to use trust modes';
    if (loading) return 'Loading trust circle…';
    if (error) return error;
    if (mode !== 'global' && circle.length === 0) return 'Your trust circle is empty';
    if (mode === 'global') return null;
    return `${circle.length} trusted account${circle.length === 1 ? '' : 's'}`;
  })();

  const trustDisabled = !connectedAddress || loading || (!error && circle.length === 0);

  return (
    <div className="header-center" title="Filter the graph by your trust circle">
      <div className="tunnel tunnel-wide">
        <EyeIcon />
        <span className="tunnel-label">Reality Tunnel</span>
        <div className="tunnel-modes" role="tablist">
          {MODES.map((m) => {
            const disabled = m.key !== 'global' && trustDisabled;
            return (
              <button
                key={m.key}
                type="button"
                className={`tunnel-mode${mode === m.key ? ' active' : ''}`}
                disabled={disabled}
                onClick={() => setMode(m.key)}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {mode === 'single' && circle.length > 0 && (
          <select
            className="tunnel-select"
            value={singleAddress}
            onChange={(e) => setSingleAddress(e.target.value)}
            title="See the graph from this account's perspective"
          >
            {circle.map((m) => (
              <option key={m.address} value={m.address}>{m.label}</option>
            ))}
          </select>
        )}

        {hint && <span className="tunnel-hint">{hint}</span>}
      </div>
    </div>
  );
}
