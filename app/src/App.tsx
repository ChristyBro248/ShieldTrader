import { useEffect, useState } from 'react';
import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { config } from './config/wagmi';
import { initFHEVM } from './config/fhevm';
import WalletConnection from './components/WalletConnection';
import Dashboard from './components/Dashboard';
import CreateRound from './components/CreateRound';
import JoinRound from './components/JoinRound';
import LeaderActions from './components/LeaderActions';
import './index.css';

const queryClient = new QueryClient();

type View = 'dashboard' | 'create' | 'join' | 'leader';

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [fhevmReady, setFhevmReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await initFHEVM();
        setFhevmReady(true);
      } catch (error) {
        console.error('Failed to initialize FHEVM:', error);
        setInitError(error instanceof Error ? error.message : 'Unknown error');
      }
    };

    // Wait for fhevm to be available on window
    if (typeof window !== 'undefined' && window.fhevm) {
      initializeApp();
    } else {
      // Retry after a short delay
      const timer = setTimeout(() => {
        if (window.fhevm) {
          initializeApp();
        } else {
          setInitError('FHEVM SDK not loaded. Please refresh the page.');
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, []);

  const renderView = () => {
    if (!fhevmReady) {
      return (
        <div className="tech-container">
          <div className="tech-text">
            {initError ? (
              <div className="error-message">
                <h3>Initialization Error</h3>
                <p>{initError}</p>
                <button 
                  className="tech-button" 
                  onClick={() => window.location.reload()}
                  style={{ marginTop: '10px' }}
                >
                  Reload Page
                </button>
              </div>
            ) : (
              <>
                <h3>Initializing FHE System...</h3>
                <div className="loading" style={{ margin: '20px 0' }}>
                  <p>Loading cryptographic modules...</p>
                </div>
              </>
            )}
          </div>
        </div>
      );
    }

    switch (currentView) {
      case 'create':
        return <CreateRound onBack={() => setCurrentView('dashboard')} />;
      case 'join':
        return <JoinRound onBack={() => setCurrentView('dashboard')} />;
      case 'leader':
        return <LeaderActions onBack={() => setCurrentView('dashboard')} />;
      default:
        return <Dashboard onNavigate={setCurrentView} />;
    }
  };

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <div className="App">
            <div className="tech-header">
              <h1 className="tech-title">ShieldTrader</h1>
              <p className="tech-text">FHE-Powered Lead Trading Protocol</p>
              <div className="wallet-status">
                <WalletConnection />
              </div>
            </div>

            <nav className="tech-container" style={{ margin: '0 20px 20px 20px' }}>
              <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button 
                  className={`tech-button ${currentView === 'dashboard' ? 'active' : ''}`}
                  onClick={() => setCurrentView('dashboard')}
                  disabled={!fhevmReady}
                >
                  Dashboard
                </button>
                <button 
                  className={`tech-button ${currentView === 'create' ? 'active' : ''}`}
                  onClick={() => setCurrentView('create')}
                  disabled={!fhevmReady}
                >
                  Create Round
                </button>
                <button 
                  className={`tech-button ${currentView === 'join' ? 'active' : ''}`}
                  onClick={() => setCurrentView('join')}
                  disabled={!fhevmReady}
                >
                  Join Round
                </button>
                <button 
                  className={`tech-button ${currentView === 'leader' ? 'active' : ''}`}
                  onClick={() => setCurrentView('leader')}
                  disabled={!fhevmReady}
                >
                  Leader Actions
                </button>
              </div>
            </nav>

            <main>
              {renderView()}
            </main>
          </div>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;