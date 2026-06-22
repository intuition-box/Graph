// src/TrustCirclePanel.js
//
// UI for the wallet-personalized Reality Tunnel modes. Lets the connected
// wallet view the graph through its own on-chain attestations about other
// accounts, through a specific trusted account's perspective, or through the
// aggregated view of everyone in its circle.
import React, { useEffect, useState, useCallback } from "react";
import { createClient } from "./api";
import {
  resolveAccountAtom,
  fetchOutboundTrustEdges,
  fetchAggregatedTrustCircle,
  buildTrustCircleGraph,
  buildGraphFromTriples,
} from "./trustCircle";

const MODES = [
  { id: "mine", label: "My Trust Circle" },
  { id: "peer", label: "Peer Perspective" },
  { id: "all", label: "All Trust Circle" },
];

const panelStyle = {
  position: "absolute",
  top: 80,
  right: 16,
  zIndex: 3,
  background: "rgba(0,0,0,0.6)",
  backdropFilter: "blur(4px)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: 12,
  color: "#fff",
  width: 300,
};

export default function TrustCirclePanel({ endpoint, connectedAddress, connectedLabel, onGraphData }) {
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState("mine");
  const [myCircle, setMyCircle] = useState([]); // [{address, label}] for the peer picker
  const [peerAddress, setPeerAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState("");

  const reset = useCallback(() => {
    setError(null);
    setSummary("");
    onGraphData(null);
  }, [onGraphData]);

  // Turning the trust tunnel off, or disconnecting the wallet, restores the
  // normal graph view.
  useEffect(() => {
    if (!connectedAddress || !active) {
      reset();
    }
  }, [connectedAddress, active, reset]);

  useEffect(() => {
    if (!active || !connectedAddress) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const client = createClient(endpoint);

        if (mode === "mine") {
          const root = await resolveAccountAtom(client, connectedAddress);
          if (!root) {
            if (!cancelled) {
              setSummary("This wallet has no atom on-chain yet — nothing to build a trust circle from.");
              onGraphData(null);
              setMyCircle([]);
            }
            return;
          }
          const edges = await fetchOutboundTrustEdges(client, root.atomId, root.address);
          if (cancelled) return;
          setMyCircle(edges.map((e) => ({ address: e.target.address, label: e.target.label })));
          if (edges.length === 0) {
            setSummary(`${root.label} hasn't made any on-chain claims about other accounts yet.`);
            onGraphData(null);
            return;
          }
          setSummary(`${edges.length} account${edges.length === 1 ? "" : "s"} this wallet has attested about.`);
          onGraphData(buildTrustCircleGraph(root, edges));
        } else if (mode === "peer") {
          if (!peerAddress) {
            setSummary("Pick someone from your trust circle to view the graph through their perspective.");
            onGraphData(null);
            return;
          }
          const peer = await resolveAccountAtom(client, peerAddress);
          if (!peer) {
            setSummary("Could not resolve that account on-chain.");
            onGraphData(null);
            return;
          }
          const edges = await fetchOutboundTrustEdges(client, peer.atomId, peer.address);
          if (cancelled) return;
          if (edges.length === 0) {
            setSummary(`${peer.label} hasn't made any on-chain claims about other accounts yet.`);
            onGraphData(null);
            return;
          }
          setSummary(`Viewing the graph through ${peer.label}'s ${edges.length} attestation${edges.length === 1 ? "" : "s"}.`);
          onGraphData(buildTrustCircleGraph(peer, edges));
        } else if (mode === "all") {
          const { root, rootEdges, triples, edgeCount } = await fetchAggregatedTrustCircle(client, connectedAddress);
          if (cancelled) return;
          if (!root || edgeCount === 0) {
            setSummary(
              root
                ? `${root.label} hasn't made any on-chain claims about other accounts yet.`
                : "This wallet has no atom on-chain yet — nothing to build a trust circle from."
            );
            onGraphData(null);
            setMyCircle([]);
            return;
          }
          setMyCircle(rootEdges.map((e) => ({ address: e.target.address, label: e.target.label })));
          setSummary(
            `Aggregated view: ${root.label}'s circle (${edgeCount} direct) plus who they trust, ${triples.length} claims total.`
          );
          onGraphData(buildGraphFromTriples(triples));
        }
      } catch (e) {
        console.error("Error building trust circle graph:", e);
        if (!cancelled) {
          setError("Could not load trust circle data from mainnet.");
          onGraphData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, mode, peerAddress, connectedAddress, endpoint]);

  if (!connectedAddress) return null;

  return (
    <section style={panelStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>Reality Tunnel: Trust Circle</h3>
        <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Enabled
        </label>
      </div>

      {active && (
        <>
          <div style={{ display: "flex", gap: 6, margin: "10px 0" }}>
            {MODES.map((m) => (
              <button
                key={m.id}
                className="navigation-button"
                onClick={() => setMode(m.id)}
                style={{
                  fontSize: 11,
                  padding: "4px 8px",
                  opacity: mode === m.id ? 1 : 0.6,
                  border: mode === m.id ? "1px solid #fff" : undefined,
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          {mode === "peer" && (
            <select
              className="tunnel-select"
              value={peerAddress}
              onChange={(e) => setPeerAddress(e.target.value)}
              style={{ width: "100%", marginBottom: 8 }}
              disabled={myCircle.length === 0}
            >
              <option value="">
                {myCircle.length === 0 ? "No one in your circle yet" : "Select a person from your circle"}
              </option>
              {myCircle.map((p) => (
                <option key={p.address} value={p.address}>
                  {p.label}
                </option>
              ))}
            </select>
          )}

          {loading && <p style={{ fontSize: 12, color: "#ccc" }}>Loading from mainnet…</p>}
          {error && <p style={{ fontSize: 12, color: "#f88" }}>{error}</p>}
          {!loading && !error && summary && <p style={{ fontSize: 12, color: "#ccc" }}>{summary}</p>}
        </>
      )}
    </section>
  );
}
