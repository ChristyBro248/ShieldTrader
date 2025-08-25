import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { LEAD_TRADING_ABI, CONTRACTS } from '../config/contracts';
import { parseUnits } from 'viem';
import { getFHEVMInstance } from '../config/fhevm';

interface JoinRoundProps {
  onBack: () => void;
}

const JoinRound = ({ onBack }: JoinRoundProps) => {
  const { address } = useAccount();
  const [roundId, setRoundId] = useState('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { writeContract, data: hash } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const { data: currentRoundId } = useReadContract({
    address: CONTRACTS.LEAD_TRADING as `0x${string}`,
    abi: LEAD_TRADING_ABI,
    functionName: 'currentRoundId',
  });

  const { data: roundInfo } = useReadContract({
    address: CONTRACTS.LEAD_TRADING as `0x${string}`,
    abi: LEAD_TRADING_ABI,
    functionName: 'getRoundInfo',
    args: roundId ? [BigInt(roundId)] : undefined,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!address) {
      setError('Please connect your wallet');
      return;
    }

    if (!roundId || !amount) {
      setError('Please fill in all fields');
      return;
    }

    const amountNum = parseFloat(amount);
    const roundIdNum = parseInt(roundId);

    if (amountNum <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    if (roundIdNum <= 0 || (currentRoundId && roundIdNum > Number(currentRoundId))) {
      setError('Invalid round ID');
      return;
    }

    try {
      setError(null);
      setIsLoading(true);

      // Get FHEVM instance
      const fhevmInstance = getFHEVMInstance();

      // Create encrypted input for the amount
      const input = fhevmInstance.createEncryptedInput(
        CONTRACTS.LEAD_TRADING,
        address
      );

      // Convert amount to proper units (6 decimals for USDT)
      const amountInUnits = parseUnits(amount, 6);
      input.add64(amountInUnits);

      // Encrypt the input
      const encryptedInput = await input.encrypt();

      // Call joinRound with encrypted amount
      writeContract({
        address: CONTRACTS.LEAD_TRADING as `0x${string}`,
        abi: LEAD_TRADING_ABI,
        functionName: 'joinRound',
        args: [
          BigInt(roundId),
          encryptedInput.handles[0],
          encryptedInput.inputProof as `0x${string}`
        ],
      });

    } catch (err) {
      console.error('Error joining round:', err);
      setError(err instanceof Error ? err.message : 'Failed to join round');
      setIsLoading(false);
    }
  };

  const formatRoundInfo = () => {
    if (!roundInfo || !Array.isArray(roundInfo)) return null;

    const [
      leader,
      targetAmount,
      duration,
      ,
      endTime,
      isActive,
      isProfitDistributed,
      depositsEnabled,
      followerCount
    ] = roundInfo;

    const targetAmountFormatted = (Number(targetAmount) / Math.pow(10, 6)).toLocaleString();
    const durationDays = Number(duration) / (24 * 60 * 60);
    const now = Math.floor(Date.now() / 1000);
    const timeRemaining = Number(endTime) - now;
    
    return {
      leader,
      targetAmountFormatted,
      durationDays,
      isActive,
      isProfitDistributed,
      depositsEnabled,
      followerCount: Number(followerCount),
      timeRemaining: timeRemaining > 0 ? timeRemaining : 0,
      hasEnded: timeRemaining <= 0
    };
  };

  const roundData = formatRoundInfo();

  if (isSuccess) {
    return (
      <div className="tech-container">
        <div className="tech-text" style={{ textAlign: 'center' }}>
          <h2 className="tech-title" style={{ color: '#00ff66' }}>Successfully Joined Round!</h2>
          <p style={{ margin: '20px 0', fontSize: '18px' }}>
            Your encrypted deposit has been added to Round #{roundId}.
          </p>
          <p style={{ margin: '10px 0', opacity: 0.8 }}>
            You can withdraw your share after the trading period ends.
          </p>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '30px' }}>
            <button className="tech-button" onClick={onBack}>
              Back to Dashboard
            </button>
            <button 
              className="tech-button" 
              onClick={() => {
                setRoundId('');
                setAmount('');
                setError(null);
                setIsLoading(false);
              }}
            >
              Join Another Round
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
          <h2 className="tech-title">Join Trading Round</h2>
        </div>

        <p style={{ marginBottom: '30px', opacity: 0.8 }}>
          Deposit encrypted USDT into an active trading round and earn profits based on the trader's performance.
        </p>

        {!address ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p className="tech-subtitle">Connect your wallet to join a trading round</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ maxWidth: '600px' }}>
            <div style={{ marginBottom: '25px' }}>
              <label className="tech-text" style={{ display: 'block', marginBottom: '8px', fontSize: '16px' }}>
                Round ID
              </label>
              <input
                type="number"
                min="1"
                max={currentRoundId ? Number(currentRoundId) : undefined}
                value={roundId}
                onChange={(e) => setRoundId(e.target.value)}
                className="tech-input"
                placeholder="e.g., 1"
                disabled={isLoading || isConfirming}
              />
              {currentRoundId ? (
                <p style={{ fontSize: '12px', opacity: 0.6, marginTop: '5px' }}>
                  Latest round ID: {Number(currentRoundId)}
                </p>
              ) : null}
            </div>

            {roundData && (
              <div style={{ marginBottom: '25px', padding: '20px', background: 'rgba(0, 255, 0, 0.05)', borderRadius: '8px', border: '1px solid rgba(0, 255, 0, 0.2)' }}>
                <h4 style={{ marginBottom: '15px', color: '#00ff66' }}>Round #{roundId} Information</h4>
                <div style={{ display: 'grid', gap: '8px', fontSize: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ opacity: 0.8 }}>Leader:</span>
                    <span style={{ fontFamily: 'monospace' }}>
                      {roundData.leader.slice(0, 6)}...{roundData.leader.slice(-4)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ opacity: 0.8 }}>Target Amount:</span>
                    <span>{roundData.targetAmountFormatted} USDT</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ opacity: 0.8 }}>Duration:</span>
                    <span>{roundData.durationDays.toFixed(1)} days</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ opacity: 0.8 }}>Followers:</span>
                    <span>{roundData.followerCount}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ opacity: 0.8 }}>Status:</span>
                    <span className={
                      !roundData.isActive ? 'status-inactive' :
                      roundData.hasEnded ? 'status-completed' :
                      !roundData.depositsEnabled ? 'status-active' :
                      'status-active'
                    }>
                      {!roundData.isActive ? 'Inactive' :
                       roundData.hasEnded ? 'Ended' :
                       !roundData.depositsEnabled ? 'Trading in Progress' :
                       'Open for Deposits'}
                    </span>
                  </div>
                  
                  {roundData.timeRemaining > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ opacity: 0.8 }}>Time Remaining:</span>
                      <span>
                        {roundData.timeRemaining > 0 ? `${Math.floor(roundData.timeRemaining / 86400)}d ${Math.floor((roundData.timeRemaining % 86400) / 3600)}h` : 'Ended'}
                      </span>
                    </div>
                  )}
                </div>

                {(!roundData.isActive || !roundData.depositsEnabled || roundData.hasEnded) && (
                  <div className="error-message" style={{ marginTop: '15px' }}>
                    This round is not accepting deposits.
                  </div>
                )}
              </div>
            )}

            <div style={{ marginBottom: '25px' }}>
              <label className="tech-text" style={{ display: 'block', marginBottom: '8px', fontSize: '16px' }}>
                Deposit Amount (USDT)
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="tech-input"
                placeholder="e.g., 1000"
                disabled={isLoading || isConfirming}
              />
              <p style={{ fontSize: '12px', opacity: 0.6, marginTop: '5px' }}>
                Your deposit will be encrypted and added to the trading pool
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
                disabled={
                  isLoading || 
                  isConfirming || 
                  !roundId || 
                  !amount || 
                  (roundData ? (!roundData.isActive || !roundData.depositsEnabled || roundData.hasEnded) : false)
                }
                style={{ flex: 1 }}
              >
                {isConfirming 
                  ? 'Confirming...' 
                  : isLoading 
                    ? 'Joining...' 
                    : 'Join Round'
                }
              </button>
              <button
                type="button"
                className="tech-button"
                onClick={() => {
                  setRoundId('');
                  setAmount('');
                  setError(null);
                }}
                disabled={isLoading || isConfirming}
              >
                Clear
              </button>
            </div>

            <div style={{ marginTop: '30px', padding: '20px', background: 'rgba(255, 102, 0, 0.05)', borderRadius: '8px', border: '1px solid rgba(255, 102, 0, 0.2)' }}>
              <h4 style={{ marginBottom: '10px', color: '#ff9900' }}>⚠️ Privacy Notice:</h4>
              <ul style={{ fontSize: '14px', lineHeight: '1.6', paddingLeft: '20px', color: '#ffcc66' }}>
                <li>Your deposit amount is encrypted and private</li>
                <li>Only you and the smart contract can see your deposit</li>
                <li>Profits are distributed proportionally to deposits</li>
                <li>You can withdraw after the trading period ends</li>
              </ul>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default JoinRound;