import React from "react";
import { FaEthereum } from "react-icons/fa";

const ClaimCard = ({ claim }) => (
  <div
    style={{
      background: "#232326",
      borderRadius: 14,
      padding: "18px 24px",
      marginBottom: 18,
      boxShadow: "0 2px 12px rgba(0,0,0,0.13)",
      display: "flex",
      alignItems: "center",
      gap: 18,
      borderLeft: "6px solid #ffd32a",
      transition: "box-shadow 0.2s, border-color 0.2s",
      position: "relative",
    }}
    className="claim-card"
  >
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
        <span style={{ color: "#ffd32a", fontWeight: 700 }}>Subject:</span>
        <span style={{ color: "#fff" }}>{claim.subject.label}</span>
        <span style={{ color: "#ffd32a", fontWeight: 700, marginLeft: 12 }}>
          Predicate:
        </span>
        <span style={{ color: "#fff" }}>{claim.predicate.label}</span>
        <span style={{ color: "#ffd32a", fontWeight: 700, marginLeft: 12 }}>
          Object:
        </span>
        <span style={{ color: "#fff" }}>{claim.object.label}</span>
      </div>
      <div
        style={{
          color: "#fff",
          fontSize: "1.1em",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <FaEthereum color="#ffd32a" />
        <span style={{ color: "#ffd32a", fontWeight: 700 }}>
          {claim.shares}
        </span>
        <span style={{ color: "#fff", fontSize: 13, marginLeft: 4 }}>
          shares
        </span>
      </div>
    </div>
    <button
      style={{
        background: "#ffd32a",
        color: "#18181b",
        border: "none",
        borderRadius: 8,
        padding: "8px 18px",
        fontWeight: "bold",
        cursor: "pointer",
        transition: "background 0.2s, color 0.2s, transform 0.1s",
        boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#ffe066")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "#ffd32a")}
      onClick={() => alert("Action à définir")}
    >
      Action
    </button>
  </div>
);

export default ClaimCard;
