import { useState } from 'react';
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
import Faucet from './components/Faucet';
import Assets from './components/Assets';
import './index.css';

const queryClient = new QueryClient();

type View = 'dashboard' | 'create' | 'join' | 'leader' | 'faucet' | 'assets';

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedRoundId, setSelectedRoundId] = useState<number | undefined>();
  const [fhevmReady, setFhevmReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const handleInitFHE = async () => {
    if (isInitializing || fhevmReady) return;
    
    setIsInitializing(true);
    setInitError(null);
    
    try {
      await initFHEVM();
      setFhevmReady(true);
    } catch (error) {
      console.error('Failed to initialize FHEVM:', error);
      setInitError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleNavigate = (view: View, roundId?: number) => {
    setCurrentView(view);
    setSelectedRoundId(roundId);
  };

  const renderView = () => {
    switch (currentView) {
      case 'create':
        return <CreateRound onBack={() => setCurrentView('dashboard')} />;
      case 'join':
        return <JoinRound onBack={() => setCurrentView('dashboard')} prefilledRoundId={selectedRoundId} />;
      case 'leader':
        return <LeaderActions onBack={() => setCurrentView('dashboard')} />;
      case 'faucet':
        return <Faucet onBack={() => setCurrentView('dashboard')} />;
      case 'assets':
        return <Assets onBack={() => setCurrentView('dashboard')} />;
      default:
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <div className="App">
            <div className="tech-header">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div>
                  <h1 className="tech-title">ShieldTrader</h1>
                  <p className="tech-text">FHE-Powered Lead Trading Protocol</p>
                </div>
                
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                  <div className="zama-status">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ 
                        width: '8px', 
                        height: '8px', 
                        borderRadius: '50%', 
                        backgroundColor: fhevmReady ? '#00ff00' : initError ? '#ff0000' : '#888888',
                        boxShadow: fhevmReady ? '0 0 6px #00ff00' : initError ? '0 0 6px #ff0000' : 'none'
                      }}></div>
                      <span className="tech-text" style={{ fontSize: '14px' }}>
                        Zama FHE: {
                          isInitializing ? 'Initializing...' :
                          fhevmReady ? 'Ready' : 
                          initError ? 'Error' : 
                          'Not Initialized'
                        }
                      </span>
                      {!fhevmReady && !isInitializing && (
                        <button 
                          className="tech-button" 
                          onClick={handleInitFHE}
                          style={{ 
                            padding: '5px 10px', 
                            fontSize: '12px',
                            minWidth: 'auto'
                          }}
                        >
                          Init FHE
                        </button>
                      )}
                      {initError && (
                        <button 
                          className="tech-button" 
                          onClick={() => {
                            setInitError(null);
                            handleInitFHE();
                          }}
                          style={{ 
                            padding: '5px 10px', 
                            fontSize: '12px',
                            minWidth: 'auto',
                            backgroundColor: '#ff4444'
                          }}
                        >
                          Retry
                        </button>
                      )}
                    </div>
                    {initError && (
                      <div style={{ 
                        fontSize: '10px', 
                        color: '#ff4444', 
                        marginTop: '5px',
                        maxWidth: '200px',
                        wordWrap: 'break-word'
                      }}>
                        {initError}
                      </div>
                    )}
                  </div>
                  
                  <div className="wallet-status">
                    <WalletConnection />
                  </div>
                </div>
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
                <button
                  className={`tech-button ${currentView === 'faucet' ? 'active' : ''}`}
                  onClick={() => setCurrentView('faucet')}
                  disabled={!fhevmReady}
                >
                  Faucet
                </button>
                <button
                  className={`tech-button ${currentView === 'assets' ? 'active' : ''}`}
                  onClick={() => setCurrentView('assets')}
                  disabled={!fhevmReady}
                >
                  Assets
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