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

// Test-address override: a real mainnet account with a 7-position trust circle
// (6 unique trusted accounts). Used when ?address= is present without a value.
const DEFAULT_TEST_ADDRESS = "0x34E3f9567aee97397Ac7A002dF2ef4f30193F1A6";

// Read a ?address=0x... override from the URL. Lets the Reality Tunnel trust
// modes be exercised without connecting a wallet. An empty `?address` (no value)
// falls back to the documented test account. Returns null when absent.
// NOTE: returned AS-IS (checksum casing preserved) — account(id:) needs it.
const getAddressOverride = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("address")) return null;
    const v = (params.get("address") || "").trim();
    return v || DEFAULT_TEST_ADDRESS;
  } catch {
    return null;
  }
};

function App() {
  const [endpoint, setEndpoint] = useState("base");
  // Reality Tunnel selection: { mode, addresses?, weights?, singleAddress? }
  const [tunnel, setTunnel] = useState({ mode: "global" });
  const { address: connectedWallet, isConnected } = useAccount();
  const [accountLabel, setAccountLabel] = useState("");

  // Precedence: a real connected wallet always wins; the ?address= URL override
  // is the fallback for driving trust modes without connecting. The effective
  // address un-gates the trust modes and feeds the trust-circle queries.
  const addressOverride = useMemo(() => getAddressOverride(), []);
  const address = connectedWallet || addressOverride;
  const hasEffectiveAddress = isConnected || !!addressOverride;

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

  // Fetch human-readable label for the effective address (e.g., ENS/Basename as
  // indexed by Intuition). Uses the connected wallet or the ?address= override.
  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!hasEffectiveAddress || !address) {
        setAccountLabel("");
        return;
      }
      try {
        const client = createClient(endpoint);
        // Pass `address` AS-IS — account(id:) is checksum-sensitive on mainnet.
        const data = await client.request(GetAccountMetadataDocument, { address });
        const label = data?.account?.label || "";
        if (!cancelled) setAccountLabel(label);
      } catch (e) {
        if (!cancelled) setAccountLabel("");
      }
    };
    run();
    return () => { cancelled = true; };
  }, [hasEffectiveAddress, address, endpoint]);

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
          address={address}
          userFilterAddress={userFilterAddress}
          trustCircle={trustCircle}
        />
      </main>
    </div>
  );
}

export default App;
