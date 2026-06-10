import React from 'react';
import { fetchTrustCircle } from './trustCircle';

const MODES = [
  { key: 'global', label: 'Global', caption: 'Everything indexed' },
  { key: 'mine', label: 'My circle', caption: 'Around accounts you trust' },
  { key: 'single', label: 'Person', caption: "Through one account's eyes" },
  { key: 'all', label: 'All circle', caption: 'Circle + your own stakes' },
];

// Cap how many circle members feed the trust-graph query so a whale account
// with hundreds of attestations can't blow up the _in filters.
const MAX_MEMBERS = 50;

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

const shortAddr = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');

const SOURCE_LABELS = { wallet: 'wallet', custom: 'override', url: 'url' };

// Reality Tunnel dock section: pick the trust mode the graph is filtered by,
// choose a perspective account, or override the viewing address entirely.
export default function RealityTunnel({
  address,
  addressLabel,
  addressSource,
  endpoint,
  onChange,
  onAddressOverride,
}) {
  const [mode, setMode] = React.useState('global');
  const [circle, setCircle] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [singleAddress, setSingleAddress] = React.useState('');
  const [draft, setDraft] = React.useState('');
  const [draftError, setDraftError] = React.useState('');

  // Load the trust circle whenever the effective address (or endpoint) changes.
  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!address) {
        setCircle([]);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const members = await fetchTrustCircle(address, endpoint);
        if (!cancelled) {
          setCircle(members.slice(0, MAX_MEMBERS));
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
  }, [address, endpoint]);

  // Emit the active selection to the parent whenever inputs change.
  React.useEffect(() => {
    if (!onChange) return;
    if (mode === 'global' || !address) {
      onChange({ mode: 'global' });
      return;
    }
    if (mode === 'single') {
      const member = circle.find(
        (m) => m.address.toLowerCase() === singleAddress.toLowerCase()
      );
      onChange({ mode: 'single', members: member ? [member] : [] });
      return;
    }
    onChange({
      mode,
      members: circle,
      selfAddress: mode === 'all' ? address : null,
    });
  }, [mode, singleAddress, circle, address, onChange]);

  const applyDraft = () => {
    const v = draft.trim();
    if (v && !ADDRESS_RE.test(v)) {
      setDraftError('Not a valid 0x address');
      return;
    }
    setDraftError('');
    setDraft('');
    onAddressOverride?.(v || null);
  };

  const hint = (() => {
    if (!address) return 'Connect a wallet or set an account below to unlock trust modes.';
    if (loading) return 'Loading trust circle…';
    if (error) return error;
    if (circle.length === 0)
      return 'No trusted accounts found — All circle still shows your own staked claims.';
    return `${circle.length} trusted account${circle.length === 1 ? '' : 's'} · weighted by stake`;
  })();

  const circleDisabled = !address || loading || (!error && circle.length === 0);
  const isDisabled = (key) => {
    if (key === 'global') return false;
    if (key === 'all') return !address || loading;
    return circleDisabled;
  };

  return (
    <>
      <div className="tunnel-modes" role="tablist">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={mode === m.key}
            className={`tunnel-mode${mode === m.key ? ' active' : ''}`}
            disabled={isDisabled(m.key)}
            onClick={() => setMode(m.key)}
          >
            <span className="tunnel-mode-label">{m.label}</span>
            <span className="tunnel-mode-caption">{m.caption}</span>
          </button>
        ))}
      </div>

      {mode === 'single' && circle.length > 0 && (
        <label className="dock-field">
          <span className="dock-field-label">Perspective</span>
          <select
            className="dock-select"
            value={singleAddress}
            onChange={(e) => setSingleAddress(e.target.value)}
            title="See the graph from this account's perspective"
          >
            {circle.map((m) => (
              <option key={m.address} value={m.address}>{m.label}</option>
            ))}
          </select>
        </label>
      )}

      <p className="tunnel-hint">{hint}</p>

      <div className="dock-field">
        <span className="dock-field-label">Account</span>
        {address && (
          <div className="tunnel-account">
            <span className="tunnel-account-name" title={address}>
              {addressLabel || shortAddr(address)}
            </span>
            <span className="tunnel-account-source">
              {SOURCE_LABELS[addressSource] || ''}
            </span>
            {addressSource === 'custom' && (
              <button
                type="button"
                className="tunnel-account-clear"
                title="Clear override"
                onClick={() => onAddressOverride?.(null)}
              >
                ✕
              </button>
            )}
          </div>
        )}
        <div className="tunnel-override">
          <input
            className="dock-input"
            type="text"
            value={draft}
            placeholder="0x… view as address"
            spellCheck={false}
            onChange={(e) => { setDraft(e.target.value); setDraftError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') applyDraft(); }}
          />
          <button
            type="button"
            className="dock-btn dock-btn-primary"
            onClick={applyDraft}
            disabled={!draft.trim()}
          >
            View
          </button>
        </div>
        {draftError && <span className="tunnel-draft-error">{draftError}</span>}
      </div>
    </>
  );
}
