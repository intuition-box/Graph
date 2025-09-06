import React, { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { createClient } from './api';
import {
  GetAccountDocument,
  FindTriplesDocument,
} from './vendor/intuition-graphql/dist/index.mjs';

const UserPositionsPanel = ({ endpoint = 'base', onFocusGraph, onClearFocus }) => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [atoms, setAtoms] = useState([]);
  const [triples, setTriples] = useState([]);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      if (!isConnected || !address) {
        setAtoms([]);
        setTriples([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const client = createClient(endpoint);

        // Fetch atoms the user has positions on via GetAccount
        const accountData = await client.request(GetAccountDocument, {
          address,
        });

        const account = accountData?.account;
        const userAtoms = account?.atoms || [];
        const mappedAtoms = userAtoms.map((a) => ({
          id: a.term_id,
          label: a.label,
          image: a.image,
        }));

        // Fetch triples where user has positions
        const triplesData = await client.request(FindTriplesDocument, {
          where: {},
          address,
        });
        const userTriples = triplesData?.triples || [];
        const mappedTriples = userTriples.map((t) => ({
          id: t.term_id,
          subject_id: t.subject_id,
          predicate_id: t.predicate_id,
          object_id: t.object_id,
          shares: (t.positions?.[0]?.shares) || '0',
        }));

        if (!cancelled) {
          setAtoms(mappedAtoms);
          setTriples(mappedTriples);
        }
        if (onFocusGraph && address) {
          onFocusGraph(address);
        }
      } catch (e) {
        console.error('Error fetching user positions:', e);
        if (!cancelled) setError('Failed to fetch positions');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [isConnected, address, endpoint]);

  if (!isConnected) return null;

  return (
    <section style={{
      position: 'absolute',
      top: 80,
      left: 16,
      zIndex: 3,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8,
      padding: 12,
      color: '#fff',
      width: 420,
      maxHeight: '60vh',
      overflow: 'auto',
    }}>
      <h3>Your Positions</h3>
      <div style={{ display: 'flex', gap: 8, margin: '4px 0 8px' }}>
        <button
          className="navigation-button"
          onClick={() => onFocusGraph && onFocusGraph(address)}
        >
          Focus graph on my positions
        </button>
        <button
          className="navigation-button"
          onClick={() => onClearFocus && onClearFocus()}
        >
          Clear focus
        </button>
        <button
          className="navigation-button"
          onClick={() => setShowDetails((v) => !v)}
        >
          {showDetails ? 'Hide details' : 'Show details'}
        </button>
      </div>
      {loading && <p>Loading positions…</p>}
      {error && <p>{error}</p>}

      {!loading && !error && (
        <div>
          <p style={{ margin: '6px 0 12px', color: '#ccc' }}>
            {atoms.length} atoms • {triples.length} triples
          </p>
          {showDetails && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <h4>Atoms</h4>
                {atoms.length === 0 ? (
                  <p>No atom positions found.</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {atoms.map((a) => (
                      <li key={a.id}>
                        {a.image ? <img src={a.image} alt="" style={{ width: 16, height: 16, verticalAlign: 'middle', marginRight: 6 }} /> : null}
                        <strong>{a.label || a.id}</strong>
                        <span style={{ marginLeft: 6, color: '#999' }}>({a.id})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h4>Triples</h4>
                {triples.length === 0 ? (
                  <p>No triple positions found.</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {triples.map((t) => (
                      <li key={t.id}>
                        <code>{t.subject_id}</code> — <code>{t.predicate_id}</code> — <code>{t.object_id}</code>
                        {t.shares && <span style={{ marginLeft: 6, color: '#999' }}>shares: {t.shares}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default UserPositionsPanel;
