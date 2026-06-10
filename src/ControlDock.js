import React, { useEffect, useState } from "react";
import { ENDPOINTS } from "./api";
import { NODE_COLORS } from "./nodeColors";
import RealityTunnel from "./RealityTunnel";

const MOBILE_BP = 768;
const isMobileViewport = () =>
  typeof window !== "undefined" && window.innerWidth <= MOBILE_BP;

const VIEW_MODES = [
  { key: "2D", label: "2D" },
  { key: "3D", label: "3D" },
  { key: "VR", label: "VR" },
  { key: "focus", label: "Focus" },
];

const LAYOUTS = [
  { key: "radial", label: "Radial" },
  { key: "none", label: "Free" },
  { key: "subject", label: "Subject" },
];

const truncate = (s, max = 18) => {
  const str = String(s || "");
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
};

const Section = ({ title, badge, collapsible, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="dock-section">
      {collapsible ? (
        <button
          type="button"
          className="dock-section-head dock-section-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="dock-section-title">{title}</span>
          {badge != null && <span className="dock-section-badge">{badge}</span>}
          <span className={`dock-chevron${open ? " open" : ""}`} aria-hidden>
            ▾
          </span>
        </button>
      ) : (
        <div className="dock-section-head">
          <span className="dock-section-title">{title}</span>
          {badge != null && <span className="dock-section-badge">{badge}</span>}
        </div>
      )}
      {(!collapsible || open) && <div className="dock-section-body">{children}</div>}
    </section>
  );
};

// Unified control dock: every graph control lives in this one glass panel —
// view switcher, Reality Tunnel trust modes, layout, branch filter, search,
// legend and data source. On mobile it collapses behind a floating chip but
// stays MOUNTED so the Reality Tunnel selection survives the toggle.
const ControlDock = ({
  viewMode,
  onViewModeChange,
  endpoint,
  onEndpointChange,
  tunnelProps,
  clusterMode,
  onClusterModeChange,
  predicateList,
  enabledPredicates,
  isPredicateOn,
  onTogglePredicate,
  onAllPredicates,
  showCreators,
  onShowCreatorsChange,
  filters,
  onFilterChange,
  onResetGraph,
  onBack,
  onForward,
  canBack,
  canForward,
}) => {
  const [isMobile, setIsMobile] = useState(isMobileViewport);
  const [open, setOpen] = useState(() => !isMobileViewport());
  useEffect(() => {
    const onResize = () => setIsMobile(isMobileViewport());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isFocus = viewMode === "focus";

  return (
    <>
      {isMobile && (
        <button
          type="button"
          className="dock-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "✕ Close" : "☰ Controls"}
        </button>
      )}

      <div className={`control-dock${isMobile && !open ? " hidden" : ""}`}>
        <Section title="View">
          <div className="dock-seg">
            {VIEW_MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                className={`dock-seg-btn${viewMode === m.key ? " active" : ""}`}
                onClick={() => onViewModeChange(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </Section>

        {!isFocus && (
          <Section title="Reality Tunnel">
            <RealityTunnel {...tunnelProps} />
          </Section>
        )}

        {viewMode === "2D" && (
          <Section title="Layout">
            <div className="dock-seg">
              {LAYOUTS.map((l) => (
                <button
                  key={l.key}
                  type="button"
                  className={`dock-seg-btn${clusterMode === l.key ? " active" : ""}`}
                  onClick={() => onClusterModeChange(l.key)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </Section>
        )}

        {viewMode === "2D" && predicateList.length > 0 && (
          <Section
            title="Branches"
            badge={predicateList.length}
            collapsible
            defaultOpen={false}
          >
            <div className="predicate-filter-head">
              <span className="dock-note">Toggle relationship categories</span>
              <button
                type="button"
                className="dock-btn"
                onClick={onAllPredicates}
                disabled={enabledPredicates === null}
              >
                All
              </button>
            </div>
            <div className="predicate-chips">
              {predicateList.map((p) => {
                const on = isPredicateOn(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    title={`${p.label} (${p.count}) — click to toggle, shift-click to isolate`}
                    className={`predicate-chip${on ? "" : " off"}`}
                    style={{
                      borderColor: p.color,
                      background: on ? p.color + "33" : "transparent",
                    }}
                    onClick={(e) => onTogglePredicate(p.id, e.shiftKey)}
                  >
                    <span
                      className="predicate-chip-dot"
                      style={{ background: p.color }}
                    />
                    {truncate(p.label)}
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {!isFocus && (
          <Section title="Search & explore" collapsible defaultOpen={false}>
            <div className="dock-search">
              {["subject", "predicate", "object"].map((kind) => (
                <input
                  key={kind}
                  className="dock-input"
                  type="text"
                  value={filters[kind]}
                  placeholder={kind[0].toUpperCase() + kind.slice(1)}
                  spellCheck={false}
                  onChange={(e) => onFilterChange(kind, e.target.value)}
                />
              ))}
            </div>
            <label className="dock-check">
              <input
                type="checkbox"
                checked={showCreators}
                onChange={(e) => onShowCreatorsChange(e.target.checked)}
              />
              Show creators
            </label>
            <div className="dock-history">
              <button type="button" className="dock-btn" onClick={onResetGraph}>
                Reset graph
              </button>
              <button
                type="button"
                className="dock-btn"
                onClick={onBack}
                disabled={!canBack}
              >
                ← Back
              </button>
              <button
                type="button"
                className="dock-btn"
                onClick={onForward}
                disabled={!canForward}
              >
                Forward →
              </button>
            </div>
          </Section>
        )}

        {!isFocus && (
          <Section title="Legend" collapsible defaultOpen={!isMobile}>
            <ul className="dock-legend">
              <li>
                <span
                  className="dock-legend-dot"
                  style={{ background: NODE_COLORS.SUBJECT }}
                />
                Subject — hub
              </li>
              <li>
                <span
                  className="dock-legend-dot"
                  style={{ background: NODE_COLORS.OBJECT }}
                />
                Object — leaf
              </li>
              {showCreators && (
                <li>
                  <span
                    className="dock-legend-dot"
                    style={{ background: NODE_COLORS.CREATOR }}
                  />
                  Creator
                </li>
              )}
              <li>
                <span className="dock-legend-edge" />
                Predicate — colored edge
              </li>
              <li className="dock-legend-trust">
                <span className="dock-legend-scale">
                  <i /> <i /> <i />
                </span>
                Node size &amp; edge width grow with staked trust
              </li>
            </ul>
          </Section>
        )}

        <div className="dock-footer">
          <span className="dock-field-label">Data source</span>
          <select
            className="dock-select"
            value={endpoint}
            onChange={(e) => onEndpointChange(e.target.value)}
          >
            {Object.entries(ENDPOINTS).map(([key, value]) => (
              <option key={key} value={key}>
                {value.displayName}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
};

export default ControlDock;
