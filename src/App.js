// src/App.js
import React, { useState, useMemo } from "react";
import "./App.css";
import GraphVisualization from "./GraphVisualization";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { createClient } from "./api";
import { GetAccountMetadataDocument } from "./vendor/intuition-graphql/dist/index.mjs";
import RealityTunnel from "./RealityTunnel";
import EndpointSelector from "./EndpointSelector";

function App() {
  const [endpoint, setEndpoint] = useState("base");
  // Reality Tunnel selection: { mode, addresses?, weights?, singleAddress? }
  const [tunnel, setTunnel] = useState({ mode: "global" });
  const { address, isConnected } = useAccount();
  const [accountLabel, setAccountLabel] = useState("");

  // Single-perspective mode reuses the existing single-address filter path.
  const userFilterAddress =
    tunnel.mode === "single" ? tunnel.singleAddress || null : null;
  // Aggregate trust-circle spec (mine / all) passed to the graph. Memoized on
  // `tunnel` so the graph effects don't re-fire on every render.
  const trustCircle = useMemo(
    () =>
      tunnel.mode === "mine" || tunnel.mode === "all"
        ? { addresses: tunnel.addresses || [], weights: tunnel.weights || {} }
        : null,
    [tunnel]
  );

  // Fetch human-readable label for the connected address (e.g., ENS/Basename as indexed by Intuition)
  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!isConnected || !address) {
        setAccountLabel("");
        return;
      }
      try {
        const client = createClient(endpoint);
        const data = await client.request(GetAccountMetadataDocument, { address });
        const label = data?.account?.label || "";
        if (!cancelled) setAccountLabel(label);
      } catch (e) {
        if (!cancelled) setAccountLabel("");
      }
    };
    run();
    return () => { cancelled = true; };
  }, [isConnected, address, endpoint]);

  return (
    <div className="App">
      <header className="App-header">
        <h1>0xIntuition Graph</h1>
        <RealityTunnel
          connectedAddress={address}
          connectedLabel={accountLabel}
          endpoint={endpoint}
          onChange={setTunnel}
        />
        <div className="header-right">
          <span className="env-badge" title="Using Intuition Mainnet API">
            <span className="env-dot" /> Intuition Mainnet
          </span>
          <ConnectButton.Custom>
            {({ account, openConnectModal, openAccountModal, mounted }) => {
              const connected = mounted && account;
              return (
                <button
                  className="navigation-button"
                  onClick={connected ? openAccountModal : openConnectModal}
                  style={{ height: 34 }}
                >
                  {connected
                    ? (accountLabel || account.displayName || 'Connected')
                    : 'Connect Wallet'}
                </button>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </header>
      <main className="App-main">
        <EndpointSelector
          currentEndpoint={endpoint}
          onEndpointChange={setEndpoint}
        />
        <GraphVisualization
          endpoint={endpoint}
          userFilterAddress={userFilterAddress}
          trustCircle={trustCircle}
        />
      </main>
    </div>
  );
}

export default App;
