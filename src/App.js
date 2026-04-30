// src/App.js
import React, { useState } from "react";
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
  const [userFilterAddress, setUserFilterAddress] = useState(null);
  const [trustThreshold, setTrustThreshold] = useState(0);
  const { address, isConnected } = useAccount();
  const [accountLabel, setAccountLabel] = useState("");

  React.useEffect(() => {
    if (isConnected && address) {
      // Default selection to the connected wallet when available
      if (userFilterAddress !== address) setUserFilterAddress(address);
    } else {
      if (userFilterAddress !== null) setUserFilterAddress(null);
    }
  }, [isConnected, address, userFilterAddress]);

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
          value={userFilterAddress || ''}
          onChange={(addr) => setUserFilterAddress(addr)}
          connectedAddress={address}
          connectedLabel={accountLabel}
        />
        <div className="header-right">
          <span className="env-badge" title="Using Intuition Mainnet API">
            <span className="env-dot" style={{ background: '#22c55e' }} /> Intuition Mainnet
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
          trustThreshold={trustThreshold}
          onTrustThresholdChange={setTrustThreshold}
        />
      </main>
    </div>
  );
}

export default App;
