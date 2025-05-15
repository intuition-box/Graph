import React, { useEffect, useState } from "react";
import { fetchTriples, fetchAtomDetails } from "./api";

const NodeDetailsSidebar = ({ triple, endpoint, onClose }) => {
  const [additionalData, setAdditionalData] = useState(null);
  const [atomDetails, setAtomDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!triple) return;

    setLoading(true);
    setError(null);
    setAtomDetails(null);

    const fetchData = async () => {
      try {
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

  if (!triple) {
    console.log("No triple provided to sidebar");
    return null;
  }

  console.log("Rendering sidebar with triple:", triple);

  return (
    <div
      style={{
        background: "#18181b",
        borderRadius: "10px",
        border: "2px solid #ffd32a",
        padding: "24px",
        boxShadow: "0 8px 30px rgba(0, 0, 0, 0.5)",
        color: "#fff",
        maxWidth: "400px",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "24px",
            color: "#ffd32a",
            fontWeight: "bold",
            letterSpacing: "0.5px",
          }}
        >
          {triple.label || "No Label"}
        </h2>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#ffd32a",
            fontSize: "24px",
            cursor: "pointer",
            padding: "4px",
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      {atomDetails && atomDetails.image && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            margin: "24px 0",
          }}
        >
          <img
            src={atomDetails.image}
            alt={atomDetails.label || "Node image"}
            style={{
              width: "120px",
              height: "120px",
              borderRadius: "50%",
              objectFit: "cover",
              border: "3px solid #ffd32a",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            }}
          />
        </div>
      )}

      {loading && (
        <div
          style={{
            textAlign: "center",
            padding: "20px",
            color: "#ffd32a",
          }}
        >
          Loading...
        </div>
      )}

      {error && (
        <div
          style={{
            color: "#ff4444",
            padding: "12px",
            background: "rgba(255,68,68,0.1)",
            borderRadius: "8px",
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      )}

      {atomDetails && (
        <div
          style={{
            background: "#232326",
            borderRadius: "8px",
            padding: "16px",
            marginBottom: "24px",
          }}
        >
          <h4
            style={{
              color: "#ffd32a",
              margin: "0 0 16px 0",
              fontSize: "18px",
              fontWeight: "bold",
            }}
          >
            Atom Info
          </h4>
          <div
            style={{
              display: "grid",
              gap: "12px",
            }}
          >
            <div>
              <span style={{ color: "#ffd32a", fontWeight: "bold" }}>ID:</span>{" "}
              {atomDetails.id}
            </div>
            <div>
              <span style={{ color: "#ffd32a", fontWeight: "bold" }}>
                Label:
              </span>{" "}
              {atomDetails.label}
            </div>
            <div>
              <span style={{ color: "#ffd32a", fontWeight: "bold" }}>
                Type:
              </span>{" "}
              {atomDetails.type}
            </div>
            <div>
              <span style={{ color: "#ffd32a", fontWeight: "bold" }}>
                Creator:
              </span>{" "}
              {atomDetails.creator?.label || "Unknown"}
            </div>
            <div>
              <span style={{ color: "#ffd32a", fontWeight: "bold" }}>
                Vault Shares:
              </span>{" "}
              {formatShares(atomDetails.vault?.total_shares || 0)}
            </div>
          </div>
        </div>
      )}

      {additionalData && additionalData.length > 0 && (
        <div
          style={{
            background: "#232326",
            borderRadius: "8px",
            padding: "16px",
          }}
        >
          <h4
            style={{
              color: "#ffd32a",
              margin: "0 0 16px 0",
              fontSize: "18px",
              fontWeight: "bold",
            }}
          >
            Related Data
          </h4>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {additionalData.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: "12px",
                  background: "#18181b",
                  borderRadius: "6px",
                  border: "1px solid #ffd32a33",
                }}
              >
                <div>
                  <span style={{ color: "#ffd32a", fontWeight: "bold" }}>
                    Subject:
                  </span>{" "}
                  {item.subject?.label}
                </div>
                <div>
                  <span style={{ color: "#ffd32a", fontWeight: "bold" }}>
                    Predicate:
                  </span>{" "}
                  {item.predicate?.label}
                </div>
                <div>
                  <span style={{ color: "#ffd32a", fontWeight: "bold" }}>
                    Object:
                  </span>{" "}
                  {item.object?.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && !additionalData?.length && (
        <div
          style={{
            textAlign: "center",
            padding: "20px",
            color: "#888",
            background: "#232326",
            borderRadius: "8px",
          }}
        >
          No additional related data found.
        </div>
      )}
    </div>
  );
};

export default NodeDetailsSidebar;
