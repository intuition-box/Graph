import React, { useEffect, useState } from "react";
import { fetchTriples, fetchAtomDetails } from "./api";
import "./NodeDetailsSidebar.css";

const PORTAL_ATOM_URL = "https://portal.intuition.systems/explore/atom";

const shortId = (id) => {
  const s = String(id || "");
  return s.length > 18 ? `${s.slice(0, 10)}…${s.slice(-6)}` : s;
};

const NodeDetailsSidebar = ({ triple, endpoint, onClose }) => {
  const [additionalData, setAdditionalData] = useState(null);
  const [atomDetails, setAtomDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!triple) return; // Early return if no triple is provided

    setLoading(true);
    setError(null);
    setAtomDetails(null); // Reset atom details when triple changes

    const fetchData = async () => {
      try {
        const response = await fetchTriples(endpoint);
        const filteredData = response.filter(
          (item) =>
            item.id === triple.id ||
            item.subject?.id === triple.id ||
            item.predicate?.id === triple.id ||
            item.object?.id === triple.id
        );
        setAdditionalData(filteredData);

        if (triple.id) {
          const atomData = await fetchAtomDetails(triple.id, endpoint);
          setAtomDetails(atomData);
        }
      } catch (err) {
        console.error("Error fetching sidebar data:", err);
        setError("Failed to fetch data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [triple, endpoint]);

  const formatShares = (shares) => (Number(shares || 0) / 1e18).toFixed(4);

  if (!triple) return null;

  return (
    <div className="node-details-sidebar">
      <div className="sidebar-head">
        <h2 title={triple.label}>{triple.label || "No Label"}</h2>
        <button
          type="button"
          className="sidebar-close"
          title="Close"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      {loading && (
        <p className="sidebar-muted">
          <span className="load-spinner" /> Loading details…
        </p>
      )}
      {error && <p className="sidebar-error">{error}</p>}

      {atomDetails && (
        <dl className="sidebar-rows">
          <div className="sidebar-row">
            <dt>ID</dt>
            <dd className="sidebar-mono" title={atomDetails.id}>
              {shortId(atomDetails.id)}
            </dd>
          </div>
          <div className="sidebar-row">
            <dt>Type</dt>
            <dd>{atomDetails.type || "—"}</dd>
          </div>
          <div className="sidebar-row">
            <dt>Emoji</dt>
            <dd>{atomDetails.emoji || "—"}</dd>
          </div>
          <div className="sidebar-row">
            <dt>Creator</dt>
            <dd>{atomDetails.creator?.label || "Unknown"}</dd>
          </div>
          <div className="sidebar-row">
            <dt>Vault shares</dt>
            <dd>{formatShares(atomDetails.vault?.total_shares)}</dd>
          </div>
        </dl>
      )}

      <a
        className="sidebar-link"
        href={`${PORTAL_ATOM_URL}/${triple.id}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        View on Intuition Portal ↗
      </a>

      {additionalData && additionalData.length > 0 ? (
        <div className="related-triples">
          <h4>Related claims</h4>
          <ul>
            {additionalData.map((item) => (
              <li key={item.id}>
                <span className="related-subject">{item.subject?.label}</span>
                <span className="related-predicate">{item.predicate?.label}</span>
                <span className="related-object">{item.object?.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        !loading && <p className="sidebar-muted">No related claims found.</p>
      )}
    </div>
  );
};

export default NodeDetailsSidebar;
