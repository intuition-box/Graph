import React, { useEffect, useState } from "react";
import { fetchTriples, fetchAtomDetails } from "./api";
import "./NodeDetailsSidebar.css";

const NodeDetailsSidebar = ({ triple, endpoint, onClose }) => {
  const [additionalData, setAdditionalData] = useState(null);
  const [atomDetails, setAtomDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  console.log("NodeDetailsSidebar rendering with triple:", triple);

  useEffect(() => {
    if (!triple) return; // Early return if no triple is provided

    console.log("NodeDetailsSidebar fetching data for triple:", triple);
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
        setError("Failed to fetch data: " + (err.message || "Unknown error"));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [triple, endpoint]);

  const formatShares = (shares) => `${(shares / 1e18).toFixed(4)} ETH`;

  // Si no triple is provided, don't render anything
  if (!triple) {
    console.log("No triple provided to sidebar");
    return null;
  }

  const sidebarStyles = {
    padding: "20px",
    color: "#ffd32a",
    width: "100%",
    height: "100%",
    overflowY: "auto",
    maxHeight: "80vh",
  };

  const closeBtnStyles = {
    position: "absolute",
    top: "10px",
    right: "15px",
    background: "none",
    border: "none",
    color: "#ffd32a",
    fontSize: "32px",
    fontWeight: "bold",
    cursor: "pointer",
    zIndex: 10000,
  };

  return (
    <div style={sidebarStyles} className="node-details-sidebar">
      <h2>{triple.label || triple.id || "Unknown Node"}</h2>
      <button
        onClick={onClose}
        style={closeBtnStyles}
        aria-label="Close details"
      >
        ×
      </button>
      
      {loading && <p className="loading-indicator">Loading details...</p>}
      {error && <p className="error-message">Error: {error}</p>}
      
      {/* Basic details, visible even when detailed info is loading */}
      <div className="basic-details" style={{ background: "#232328", padding: "12px", borderRadius: "8px", margin: "15px 0", borderLeft: "3px solid #ffe066" }}>
        <p><strong>ID:</strong> {triple.id}</p>
        <p><strong>Type:</strong> {triple.type || "N/A"}</p>
        {triple.color && (
          <p>
            <strong>Color:</strong> 
            <span style={{ 
              backgroundColor: triple.color, 
              width: 20, 
              height: 20, 
              display: 'inline-block', 
              marginLeft: 10, 
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.3)'
            }}></span>
          </p>
        )}
      </div>

      {atomDetails && (
        <div className="atom-details" style={{ background: "#232328", padding: "12px", borderRadius: "8px", margin: "15px 0", borderLeft: "3px solid #ffd32a" }}>
          <h4 style={{ color: "#ffd32a", fontSize: "18px", marginTop: "0" }}>Atom Info</h4>
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
        </div>
      )}

      {additionalData && additionalData.length > 0 ? (
        <div className="related-triples" style={{ 
          background: "#18181b", 
          border: "1.5px solid #ffd32a", 
          borderRadius: "8px", 
          padding: "14px 12px 10px 12px", 
          marginTop: "20px",
          maxHeight: "200px",
          overflowY: "auto" 
        }}>
          <h4 style={{ color: "#ffd32a", marginBottom: "10px", fontSize: "15px", fontWeight: "bold" }}>Related Data:</h4>
          <ul style={{ listStyle: "none", padding: "0", margin: "0" }}>
            {additionalData.map((item) => (
              <li key={item.id} style={{ marginBottom: "10px", background: "#232326", borderRadius: "6px", padding: "6px 10px" }}>
                <strong>Subject:</strong> {item.subject?.label || item.subject?.id || "N/A"} |{" "}
                <strong>Predicate:</strong> {item.predicate?.label || item.predicate?.id || "N/A"} |{" "}
                <strong>Object:</strong> {item.object?.label || item.object?.id || "N/A"}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        !loading && <p>No additional related data found.</p>
      )}

      <button
        style={{
          background: "rgba(255, 211, 42, 0.9)",
          color: "#18181b",
          border: "none",
          borderRadius: 8,
          width: "100%",
          height: 40,
          fontSize: 16,
          fontWeight: "bold",
          boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
          cursor: "pointer",
          textTransform: "uppercase",
          transition: "background 0.2s, color 0.2s, transform 0.1s",
          marginTop: 20,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 224, 102, 0.9)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 211, 42, 0.9)")}
        onClick={onClose}
      >
        Close
      </button>
    </div>
  );
};

export default NodeDetailsSidebar;
