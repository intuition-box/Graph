// src/App.js
import React, { useState } from "react";
import "./App.css";
import GraphVisualization from "./GraphVisualization";
import EndpointSelector from "./EndpointSelector";

function App() {
  const [endpoint, setEndpoint] = useState("base");

  return (
    <div className="App">
      <main className="App-main">
        <EndpointSelector
          currentEndpoint={endpoint}
          onEndpointChange={setEndpoint}
        />
        <GraphVisualization endpoint={endpoint} />
      </main>
    </div>
  );
}

export default App;
