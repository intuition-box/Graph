import React, { useEffect, useState } from "react";
import { fetchTriples, fetchAtomDetails } from "./api";
import "./NodeDetailsSidebar.css";

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
        // Log the incoming triple for debugging
        console.log("Received triple:", triple);

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
          console.log("Fetching atom details for ID:", triple.id);
          const atomData = await fetchAtomDetails(
            parseInt(triple.id),
            endpoint
          );
          console.log("Received atom details:", atomData);
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

  const formatShares = (shares) => `${(shares / 1e18).toFixed(4)} ETH`;

  // If no triple is provided, don't render anything
  if (!triple) {
    console.log("No triple provided to sidebar");
    return null;
  }

  console.log("Rendering sidebar with triple:", triple);

  return (
    <div className="node-details-sidebar">
      <h2>{triple.label || "No Label"} Details</h2>
      {loading && <p>Loading...</p>}
      {error && <p>{error}</p>}

      {atomDetails && (
        <>
          <h4>Atom Info</h4>
          <p>
            <strong>ID:</strong> {atomDetails.id}
          </p>
          <p>
            <strong>Label:</strong> {atomDetails.label}
          </p>
          <p>
            <strong>Type:</strong> {atomDetails.type}
          </p>
          <p>
            <strong>Emoji:</strong> {atomDetails.emoji || "N/A"}
          </p>
          <p>
            <strong>Creator:</strong> {atomDetails.creator?.label || "Unknown"}
          </p>
          <p>
            <strong>Vault Shares:</strong>{" "}
            {formatShares(atomDetails.vault?.total_shares || 0)}
          </p>
        </>
      )}

      {additionalData && additionalData.length > 0 ? (
        <div className="related-triples">
          <h4>Related Data:</h4>
          <ul>
            {additionalData.map((item) => (
              <li key={item.id}>
                <strong>Subject:</strong> {item.subject?.label} |{" "}
                <strong>Predicate:</strong> {item.predicate?.label} |{" "}
                <strong>Object:</strong> {item.object?.label}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        !loading && <p>No additional related data found.</p>
      )}

      <button
        style={{
          background: "#ffd32a",
          color: "#18181b",
          border: "none",
          borderRadius: 12,
          width: 120,
          height: 40,
          fontSize: 15,
          fontWeight: "bold",
          boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
          cursor: "pointer",
          textTransform: "uppercase",
          transition: "background 0.2s, color 0.2s, transform 0.1s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#ffe066")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#ffd32a")}
        onClick={onClose}
      >
        Close
      </button>
    </div>
  );
};

export default NodeDetailsSidebar;
