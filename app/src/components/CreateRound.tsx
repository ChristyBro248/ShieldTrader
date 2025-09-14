import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { LEAD_TRADING_ABI, CONTRACTS } from '../config/contracts';
import { parseUnits } from 'viem';

interface CreateRoundProps {
  onBack: () => void;
}

const CreateRound = ({ onBack }: CreateRoundProps) => {
  const { address } = useAccount();
  const [targetAmount, setTargetAmount] = useState('');
  const [duration, setDuration] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { writeContract, data: hash } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!address) {
      setError('Please connect your wallet');
      return;
    }

    if (!targetAmount || !duration) {
      setError('Please fill in all fields');
      return;
    }

    const targetAmountNum = parseFloat(targetAmount);
    const durationNum = parseInt(duration);

    if (targetAmountNum < 1000) {
      setError('Target amount must be at least 1000 USDT');
      return;
    }

    if (durationNum < 1 || durationNum > 365) {
      setError('Duration must be between 1 and 365 days');
      return;
    }

    try {
      setError(null);
      setIsLoading(true);

      // Convert target amount to wei (6 decimals for USDT)
      const targetAmountWei = parseUnits(targetAmount, 6);
      // Convert duration to seconds
      const durationSeconds = BigInt(Math.floor(durationNum) * 24 * 60 * 60);

      writeContract({
        address: CONTRACTS.LEAD_TRADING as `0x${string}`,
        abi: LEAD_TRADING_ABI,
        functionName: 'createTradingRound',
        args: [targetAmountWei, durationSeconds],
      });

    } catch (err) {
      console.error('Error creating round:', err);
      setError(err instanceof Error ? err.message : 'Failed to create round');
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="tech-container">
        <div className="tech-text" style={{ textAlign: 'center' }}>
          <h2 className="tech-title" style={{ color: '#00ff66' }}>Round Created Successfully!</h2>
          <p style={{ margin: '20px 0', fontSize: '18px' }}>
            Your trading round has been created and is now accepting deposits.
          </p>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '30px' }}>
            <button className="tech-button" onClick={onBack}>
              Back to Dashboard
            </button>
            <button 
              className="tech-button" 
              onClick={() => {
                setTargetAmount('');
                setDuration('');
                setError(null);
                setIsLoading(false);
              }}
            >
              Create Another Round
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tech-container">
      <div className="tech-text">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
          <button className="tech-button" onClick={onBack} style={{ marginRight: '20px' }}>
            ← Back
          </button>
          <h2 className="tech-title">Create Trading Round</h2>
        </div>

        <p style={{ marginBottom: '30px', opacity: 0.8 }}>
          Set up a new lead trading round where followers can deposit encrypted USDT for you to trade.
        </p>

        {!address ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p className="tech-subtitle">Connect your wallet to create a trading round</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ maxWidth: '500px' }}>
            <div style={{ marginBottom: '25px' }}>
              <label className="tech-text" style={{ display: 'block', marginBottom: '8px', fontSize: '16px' }}>
                Target Amount (USDT)
              </label>
              <input
                type="number"
                min="1000"
                step="0.01"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                className="tech-input"
                placeholder="e.g., 10000"
                disabled={isLoading || isConfirming}
              />
              <p style={{ fontSize: '12px', opacity: 0.6, marginTop: '5px' }}>
                Minimum 1000 USDT required
              </p>
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label className="tech-text" style={{ display: 'block', marginBottom: '8px', fontSize: '16px' }}>
                Duration (Days)
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="tech-input"
                placeholder="e.g., 30"
                disabled={isLoading || isConfirming}
              />
              <p style={{ fontSize: '12px', opacity: 0.6, marginTop: '5px' }}>
                Trading period length (1-365 days)
              </p>
            </div>

            {error && (
              <div className="error-message" style={{ marginBottom: '20px' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
              <button
                type="submit"
                className={`tech-button ${isLoading || isConfirming ? 'loading' : ''}`}
                disabled={isLoading || isConfirming || !targetAmount || !duration}
                style={{ flex: 1 }}
              >
                {isConfirming 
                  ? 'Confirming...' 
                  : isLoading 
                    ? 'Creating...' 
                    : 'Create Trading Round'
                }
              </button>
              <button
                type="button"
                className="tech-button"
                onClick={() => {
                  setTargetAmount('');
                  setDuration('');
                  setError(null);
                }}
                disabled={isLoading || isConfirming}
              >
                Clear
              </button>
            </div>

            <div style={{ marginTop: '30px', padding: '20px', background: 'rgba(0, 255, 0, 0.05)', borderRadius: '8px', border: '1px solid rgba(0, 255, 0, 0.2)' }}>
              <h4 style={{ marginBottom: '10px', color: '#00ff66' }}>How it works:</h4>
              <ul style={{ fontSize: '14px', lineHeight: '1.6', paddingLeft: '20px' }}>
                <li>Followers deposit encrypted USDT until target amount is reached</li>
                <li>You can stop deposits and extract funds to start trading</li>
                <li>After the duration ends, deposit profits back to the contract</li>
                <li>Followers can withdraw their share based on their deposit ratio</li>
              </ul>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CreateRound;