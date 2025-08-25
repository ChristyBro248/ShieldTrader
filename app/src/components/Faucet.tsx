import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { FAUCET_ABI, MOCK_USDT_ABI, CONTRACTS } from '../config/contracts';

interface FaucetProps {
  onBack: () => void;
}


const Faucet = ({ onBack }: FaucetProps) => {
  const { address } = useAccount();
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Contract interactions
  const { writeContract, data: hash, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // Read contract data
  const { data: canClaimData, refetch: refetchCanClaim } = useReadContract({
    address: CONTRACTS.FAUCET as `0x${string}`,
    abi: FAUCET_ABI,
    functionName: 'canClaimTokens',
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  });

  const { data: faucetBalance, refetch: refetchFaucetBalance } = useReadContract({
    address: CONTRACTS.FAUCET as `0x${string}`,
    abi: FAUCET_ABI,
    functionName: 'getFaucetBalance',
  });

  const { data: userBalance, refetch: refetchUserBalance } = useReadContract({
    address: CONTRACTS.MOCK_USDT as `0x${string}`,
    abi: MOCK_USDT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  });

  const { data: lastClaimTime } = useReadContract({
    address: CONTRACTS.FAUCET as `0x${string}`,
    abi: FAUCET_ABI,
    functionName: 'lastClaimTime',
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  });

  // Parse claim data
  const canClaim = canClaimData?.[0] || false;
  const timeRemainingFromContract = canClaimData?.[1] || 0n;

  // Update countdown timer
  useEffect(() => {
    if (timeRemainingFromContract > 0n) {
      setTimeRemaining(Number(timeRemainingFromContract));
      
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            refetchCanClaim();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [timeRemainingFromContract, refetchCanClaim]);

  // Handle transaction confirmation
  useEffect(() => {
    if (isConfirmed) {
      setSuccess('Successfully claimed 1,000 cUSDT tokens!');
      setClaiming(false);
      setError(null);
      
      // Refetch all data
      refetchCanClaim();
      refetchFaucetBalance();
      refetchUserBalance();
    }
  }, [isConfirmed, refetchCanClaim, refetchFaucetBalance, refetchUserBalance]);

  const handleClaim = async () => {
    if (!address) {
      setError('Please connect your wallet');
      return;
    }

    if (!canClaim) {
      setError('Cannot claim tokens at this time');
      return;
    }

    setError(null);
    setSuccess(null);
    setClaiming(true);

    try {
      await writeContract({
        address: CONTRACTS.FAUCET as `0x${string}`,
        abi: FAUCET_ABI,
        functionName: 'claimTokens',
      });
    } catch (err: any) {
      console.error('Claim error:', err);
      setError(err?.message || 'Failed to claim tokens');
      setClaiming(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (seconds <= 0) return '00:00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isLoading = isPending || isConfirming || claiming;

  return (
    <div className="tech-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2 className="tech-title">cUSDT Faucet</h2>
        <button className="tech-button" onClick={onBack}>
          Back to Dashboard
        </button>
      </div>

      <div className="tech-grid">
        {/* Faucet Status Card */}
        <div className="tech-card">
          <h3 className="tech-subtitle">Faucet Status</h3>
          <div className="tech-stats">
            <div className="tech-stat-item">
              <span className="tech-label">Faucet Balance:</span>
              <span className="tech-value">
                {faucetBalance ? formatUnits(faucetBalance, 6) : '0'} USDT
              </span>
            </div>
            <div className="tech-stat-item">
              <span className="tech-label">Claim Amount:</span>
              <span className="tech-value tech-highlight">1,000 cUSDT</span>
            </div>
            <div className="tech-stat-item">
              <span className="tech-label">Cooldown Period:</span>
              <span className="tech-value">24 Hours</span>
            </div>
          </div>
        </div>

        {/* User Status Card */}
        <div className="tech-card">
          <h3 className="tech-subtitle">Your Status</h3>
          <div className="tech-stats">
            <div className="tech-stat-item">
              <span className="tech-label">Your USDT Balance:</span>
              <span className="tech-value">
                {userBalance ? formatUnits(userBalance, 6) : '0'} USDT
              </span>
            </div>
            <div className="tech-stat-item">
              <span className="tech-label">Can Claim:</span>
              <span className={`tech-value ${canClaim ? 'tech-success' : 'tech-error'}`}>
                {canClaim ? 'Yes' : 'No'}
              </span>
            </div>
            {!canClaim && timeRemaining > 0 && (
              <div className="tech-stat-item">
                <span className="tech-label">Next Claim Available:</span>
                <span className="tech-value tech-highlight">
                  {formatTime(timeRemaining)}
                </span>
              </div>
            )}
            {lastClaimTime && lastClaimTime > 0n && (
              <div className="tech-stat-item">
                <span className="tech-label">Last Claim:</span>
                <span className="tech-value">
                  {new Date(Number(lastClaimTime) * 1000).toLocaleString()}
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
            disabled={!address || !canClaim || isLoading}
            style={{ width: '100%', padding: '15px' }}
          >
            {isLoading 
              ? 'Processing...' 
              : !address 
                ? 'Connect Wallet' 
                : !canClaim 
                  ? timeRemaining > 0 
                    ? `Wait ${formatTime(timeRemaining)}`
                    : 'Cannot Claim'
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
              {claiming && !isPending && !isConfirming && 'Processing claim...'}
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