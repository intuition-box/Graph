import React from 'react';
import { ENDPOINTS } from './api';

const EndpointSelector = ({ currentEndpoint, onEndpointChange }) => {
  return (
    <div
      style={{
        position: "absolute",
        top: "10px",
        left: "10px",
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        gap: "10px",
        background: "#444",
        color: "black",
        padding: "10px",
        borderRadius: "4px",
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
        style={{
          padding: "5px",
          borderRadius: "4px",
          border: "none",
          cursor: "pointer",
          fontSize: "14px",
          flex: 1,
        }}
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
