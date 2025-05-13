// src/App.js
import React from "react";
import "./App.css";
import GraphVisualization from "./GraphVisualization";

function App() {
  // Endpoint fixé à 'baseSepolia' (testnet)
  const endpoint = "baseSepolia";

  return (
    <div className="App">
      <main className="App-main">
        <GraphVisualization endpoint={endpoint} />
      </main>
    </div>
  );
}

export default App;
