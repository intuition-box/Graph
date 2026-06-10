import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultWallets, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiConfig, configureChains, createConfig } from 'wagmi';
import { base, baseSepolia, mainnet, sepolia } from 'wagmi/chains';
import { publicProvider } from 'wagmi/providers/public';
import { defineChain } from 'viem';

const projectId = process.env.REACT_APP_WALLETCONNECT_PROJECT_ID || 'demo';

// Intuition mainnet L3 (chain 1155, native TRUST). Listed first so RainbowKit
// treats it as the app's primary chain.
const intuition = defineChain({
  id: 1155,
  name: 'Intuition',
  network: 'intuition',
  nativeCurrency: { name: 'TRUST', symbol: 'TRUST', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.intuition.systems'] },
    public: { http: ['https://rpc.intuition.systems'] },
  },
  blockExplorers: {
    default: { name: 'Intuition Explorer', url: 'https://explorer.intuition.systems' },
  },
});

const { chains, publicClient } = configureChains(
  [intuition, base, baseSepolia, mainnet, sepolia],
  [publicProvider()]
);

const { connectors } = getDefaultWallets({ appName: 'Intuition Graph', projectId, chains });

const wagmiConfig = createConfig({ autoConnect: true, connectors, publicClient });

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <WagmiConfig config={wagmiConfig}>
      <RainbowKitProvider theme={darkTheme()} chains={chains} modalSize="compact">
        <App />
      </RainbowKitProvider>
    </WagmiConfig>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
