import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACTS } from '../config/contracts';

interface FaucetProps {
  onBack: () => void;
}


// Simple cUSDT faucet ABI - just the faucet function
const CUSDT_FAUCET_ABI = [
  {
    "inputs": [],
    "name": "faucet",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

const Faucet = ({ onBack }: FaucetProps) => {
  const { address } = useAccount();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Contract interactions
  const { writeContract, data: hash, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // Handle transaction confirmation
  if (isConfirmed && !success) {
    setSuccess('Successfully claimed 1,000 cUSDT tokens!');
    setError(null);
  }

  const handleClaim = async () => {
    if (!address) {
      setError('Please connect your wallet');
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await writeContract({
        address: CONTRACTS.CUSDT as `0x${string}`,
        abi: CUSDT_FAUCET_ABI,
        functionName: 'faucet',
      });
    } catch (err: any) {
      console.error('Claim error:', err);
      setError(err?.message || 'Failed to claim tokens');
    }
  };

  const isLoading = isPending || isConfirming;

  return (
    <div className="tech-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2 className="tech-title">cUSDT Faucet</h2>
        <button className="tech-button" onClick={onBack}>
          Back to Dashboard
        </button>
      </div>

      <div className="tech-grid">
        {/* Faucet Info Card */}
        <div className="tech-card">
          <h3 className="tech-subtitle">cUSDT Faucet</h3>
          <div className="tech-stats">
            <div className="tech-stat-item">
              <span className="tech-label">Claim Amount:</span>
              <span className="tech-value tech-highlight">1,000 cUSDT</span>
            </div>
            <div className="tech-stat-item">
              <span className="tech-label">Token Type:</span>
              <span className="tech-value">Confidential cUSDT (FHE Encrypted)</span>
            </div>
            <div className="tech-stat-item">
              <span className="tech-label">Usage:</span>
              <span className="tech-value">Direct use in trading rounds</span>
            </div>
          </div>
        </div>

        {/* Status Card */}
        <div className="tech-card">
          <h3 className="tech-subtitle">Claim Status</h3>
          <div className="tech-stats">
            <div className="tech-stat-item">
              <span className="tech-label">Wallet:</span>
              <span className={`tech-value ${address ? 'tech-success' : 'tech-error'}`}>
                {address ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            {address && (
              <div className="tech-stat-item">
                <span className="tech-label">Address:</span>
                <span className="tech-value" style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                  {address.slice(0, 6)}...{address.slice(-4)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Claim Section */}
      <div className="tech-card" style={{ marginTop: '20px' }}>
        <h3 className="tech-subtitle">Claim Tokens</h3>
        <p className="tech-text">
          Claim 1,000 cUSDT tokens for testing purposes. You can claim once every 24 hours.
        </p>
        
        {error && (
          <div className="tech-error" style={{ marginTop: '15px' }}>
            ⚠️ {error}
          </div>
        )}
        
        {success && (
          <div className="tech-success" style={{ marginTop: '15px' }}>
            ✅ {success}
          </div>
        )}

        <div style={{ marginTop: '20px' }}>
          <button 
            className="tech-button tech-button-primary"
            onClick={handleClaim}
            disabled={!address || isLoading}
            style={{ width: '100%', padding: '15px' }}
          >
            {isLoading 
              ? 'Processing...' 
              : !address 
                ? 'Connect Wallet' 
                : 'Claim 1,000 cUSDT'
            }
          </button>
        </div>

        {isLoading && (
          <div className="tech-loading" style={{ marginTop: '15px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px',
              fontSize: '14px'
            }}>
              <div className="tech-spinner"></div>
              {isPending && 'Waiting for wallet confirmation...'}
              {isConfirming && 'Confirming transaction...'}
            </div>
          </div>
        )}
      </div>

      {/* Information Card */}
      <div className="tech-card" style={{ marginTop: '20px' }}>
        <h3 className="tech-subtitle">How it Works</h3>
        <div className="tech-text">
          <ol style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
            <li>Connect your wallet to the application</li>
            <li>Click "Claim 1,000 cUSDT" to receive encrypted test tokens</li>
            <li>Wait 24 hours before claiming again</li>
            <li>Use the cUSDT tokens directly in trading rounds</li>
            <li>cUSDT are confidential tokens powered by FHE encryption</li>
          </ol>
          <p style={{ marginTop: '15px', fontSize: '12px', opacity: '0.8' }}>
            Note: This is a testnet faucet for demonstration purposes only. 
            These tokens have no real value.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Faucet;