import React from "react";
import { ENDPOINTS } from "./api";

const EndpointSelector = ({ currentEndpoint, onEndpointChange }) => {
  return (
    <div
      className="agent-navbar"
      style={{
        position: "absolute",
        top: "10px",
        left: "10px",
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        gap: "10px",
        width: "270px",
        height: "25px",
      }}
    >
      <label htmlFor="endpoint" style={{ fontSize: "14px" }}>
        Endpoint:
      </label>
      <select
        id="endpoint"
        value={currentEndpoint}
        onChange={(e) => onEndpointChange(e.target.value)}
        className="agent-endpoint-select"
        style={{ width: "190px" }}
      >
        {Object.entries(ENDPOINTS).map(([key, value]) => (
          <option key={key} value={key}>
            {value.displayName}
          </option>
        ))}
      </select>
    </div>
  );
};

export default EndpointSelector;
