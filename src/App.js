// src/App.js
import React, { useState, useMemo, useCallback } from "react";
import "./App.css";
import GraphVisualization from "./GraphVisualization";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { createClient } from "./api";
import { GetAccountMetadataDocument } from "./vendor/intuition-graphql/dist/index.mjs";

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
  // Reality Tunnel selection: { mode } or { mode, members, selfAddress }.
  const [tunnel, setTunnel] = useState({ mode: "global" });
  const { address: connectedWallet } = useAccount();
  const [accountLabel, setAccountLabel] = useState("");
  const [manualAddress, setManualAddress] = useState("");

  // Precedence: an explicit dock override wins over the connected wallet, which
  // wins over the ?address= URL override. The effective address un-gates the
  // trust modes and feeds the trust-circle queries.
  const urlOverride = useMemo(() => getAddressOverride(), []);
  const address = manualAddress || connectedWallet || urlOverride;
  const addressSource = manualAddress
    ? "custom"
    : connectedWallet
    ? "wallet"
    : urlOverride
    ? "url"
    : null;

  // Dock override input handler: keeps the ?address= param in sync so the view
  // is shareable/reload-safe.
  const handleAddressOverride = useCallback((value) => {
    setManualAddress(value || "");
    try {
      const url = new URL(window.location.href);
      if (value) url.searchParams.set("address", value);
      else url.searchParams.delete("address");
      window.history.replaceState(null, "", url);
    } catch {
      /* noop */
    }
  }, []);

  // Fetch human-readable label for the effective address (e.g., ENS/Basename as
  // indexed by Intuition).
  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!address) {
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
  }, [address, endpoint]);

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-brand">
          <h1>0xIntuition Graph</h1>
          <span className="header-tagline">Reality Tunnel explorer</span>
        </div>
        <div className="header-right">
          <span className="env-badge" title="Using Intuition Mainnet API">
            <span className="env-dot" /> Intuition Mainnet
          </span>
          <ConnectButton.Custom>
            {({ account, openConnectModal, openAccountModal, mounted }) => {
              const connected = mounted && account;
              return (
                <button
                  className="navigation-button connect-button"
                  onClick={connected ? openAccountModal : openConnectModal}
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
        <GraphVisualization
          endpoint={endpoint}
          onEndpointChange={setEndpoint}
          address={address}
          addressSource={addressSource}
          accountLabel={accountLabel}
          onAddressOverride={handleAddressOverride}
          tunnel={tunnel}
          onTunnelChange={setTunnel}
        />
      </main>
    </div>
  );
}

export default App;
