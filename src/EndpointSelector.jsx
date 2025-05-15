import React from "react";

const EndpointSelector = ({ endpoint, onEndpointChange }) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        background: "#18181b",
        padding: "16px 24px",
        borderRadius: "10px",
        border: "2px solid #ffd32a",
        boxShadow: "0 8px 30px rgba(0, 0, 0, 0.5)",
      }}
    >
      <label
        style={{
          color: "#ffd32a",
          fontSize: "14px",
          fontWeight: "bold",
          letterSpacing: "0.5px",
        }}
      >
        Network:
      </label>
      <select
        value={endpoint}
        onChange={(e) => onEndpointChange(e.target.value)}
        style={{
          padding: "8px 12px",
          borderRadius: "8px",
          border: "1px solid #ffd32a",
          fontSize: "14px",
          background: "#232326",
          color: "#fff",
          cursor: "pointer",
          transition: "border-color 0.2s",
          outline: "none",
          minWidth: "200px",
        }}
      >
        <option value="baseSepolia">Base Testnet</option>
        <option value="base">Base Mainnet</option>
      </select>
    </div>
  );
};

export default EndpointSelector;
