import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { LEAD_TRADING_ABI, CONTRACTS, CUSDT_ABI } from '../config/contracts';
import { parseUnits } from 'viem';
import { getFHEVMInstance } from '../config/fhevm';
import { useProfitDecryption } from '../hooks/useProfitDecryption';

interface LeaderActionsProps {
  onBack: () => void;
}

type ActionType = 'stop-deposits' | 'extract-funds' | 'deposit-profit' | 'distribute-profit' | null;

const LeaderActions = ({ onBack }: LeaderActionsProps) => {
  const { address } = useAccount();
  const [selectedAction, setSelectedAction] = useState<ActionType>(null);
  const [roundId, setRoundId] = useState('');
  const [profitAmount, setProfitAmount] = useState('');
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
    address: roundId ? CONTRACTS.LEAD_TRADING as `0x${string}` : undefined,
    abi: LEAD_TRADING_ABI,
    functionName: 'getRoundInfo',
    args: roundId ? [BigInt(roundId)] : undefined,
  });

  const parseHex = (proof: Uint8Array) => {
    let formattedProof: string
    formattedProof = `0x${Array.from(proof).map(b => b.toString(16).padStart(2, '0')).join('')}`;
    return formattedProof
  }
  const { data: fundsExtracted } = useReadContract({
    address: roundId ? CONTRACTS.LEAD_TRADING as `0x${string}` : undefined,
    abi: LEAD_TRADING_ABI,
    functionName: 'isFundsExtracted',
    args: roundId ? [BigInt(roundId)] : undefined,
  });

  const { data: encryptedTotalProfit } = useReadContract({
    address: roundId ? CONTRACTS.LEAD_TRADING as `0x${string}` : undefined,
    abi: LEAD_TRADING_ABI,
    functionName: 'getTotalProfit',
    args: roundId ? [BigInt(roundId)] : undefined,
  });

  // Check if user has set operator permission for cUSDT transfers
  const { data: isOperatorSet } = useReadContract({
    address: CONTRACTS.CUSDT as `0x${string}`,
    abi: CUSDT_ABI,
    functionName: 'isOperator',
    args: address ? [address, CONTRACTS.LEAD_TRADING] : undefined,
  });

  // Decrypt the total profit
  const { decryptedProfit, isDecrypting: isProfitDecrypting, error: profitDecryptionError, isZeroValue, decrypt: decryptProfit } = useProfitDecryption(
    encryptedTotalProfit as string,
    parseInt(roundId) || 0
  );

  const handleAction = async (action: ActionType) => {
    if (!address) {
      setError('Please connect your wallet');
      return;
    }

    if (!roundId) {
      setError('Please enter a round ID');
      return;
    }

    if (action === 'deposit-profit' && !profitAmount) {
      setError('Please enter profit amount');
      return;
    }

    try {
      setError(null);
      setIsLoading(true);

      switch (action) {
        case 'stop-deposits':
          writeContract({
            address: CONTRACTS.LEAD_TRADING as `0x${string}`,
            abi: LEAD_TRADING_ABI,
            functionName: 'stopDeposits',
            args: [BigInt(roundId)],
          });
          break;

        case 'extract-funds':
          writeContract({
            address: CONTRACTS.LEAD_TRADING as `0x${string}`,
            abi: LEAD_TRADING_ABI,
            functionName: 'extractFunds',
            args: [BigInt(roundId)],
          });
          break;

        case 'deposit-profit':
          // Check if operator is set first
          if (!isOperatorSet) {
            setError('Setting operator permission first...');
            const until = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 hours

            writeContract({
              address: CONTRACTS.CUSDT as `0x${string}`,
              abi: CUSDT_ABI,
              functionName: 'setOperator',
              args: [CONTRACTS.LEAD_TRADING as `0x${string}`, until]
            });
            return;
          }

          const fhevmInstance = getFHEVMInstance();
          const input = fhevmInstance.createEncryptedInput(
            CONTRACTS.LEAD_TRADING,
            address
          );

          const profitAmountInUnits = parseUnits(profitAmount, 6);
          input.add64(profitAmountInUnits);

          const encryptedInput = await input.encrypt();

          writeContract({
            address: CONTRACTS.LEAD_TRADING as `0x${string}`,
            abi: LEAD_TRADING_ABI,
            functionName: 'depositProfit',
            args: [
              BigInt(roundId),
              parseHex(encryptedInput.handles[0]) as `0x${string}`,
              parseHex(encryptedInput.inputProof) as `0x${string}`
            ],
          });
          break;

        case 'distribute-profit':
          writeContract({
            address: CONTRACTS.LEAD_TRADING as `0x${string}`,
            abi: LEAD_TRADING_ABI,
            functionName: 'distributeProfit',
            args: [BigInt(roundId)],
          });
          break;
      }

    } catch (err) {
      console.error('Error executing action:', err);
      setError(err instanceof Error ? err.message : 'Failed to execute action');
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
      followerCount,
      unitProfitRate,
      decryptedTotalDeposited,
      decryptedTotalProfit
    ] = roundInfo;

    const targetAmountFormatted = (Number(targetAmount) / Math.pow(10, 6)).toLocaleString();
    const durationDays = Number(duration) / (24 * 60 * 60);
    const now = Math.floor(Date.now() / 1000);
    const timeRemaining = Number(endTime) - now;
    const isUserLeader = leader.toLowerCase() === address?.toLowerCase();
    
    return {
      leader,
      isUserLeader,
      targetAmountFormatted,
      durationDays,
      isActive,
      isProfitDistributed,
      depositsEnabled,
      followerCount: Number(followerCount),
      timeRemaining: timeRemaining > 0 ? timeRemaining : 0,
      hasEnded: timeRemaining <= 0,
      decryptedTotalDeposited: Number(decryptedTotalDeposited) / Math.pow(10, 6),
      decryptedTotalProfit: Number(decryptedTotalProfit) / Math.pow(10, 6),
      unitProfitRate: Number(unitProfitRate) / Math.pow(10, 18),
      fundsExtracted: Boolean(fundsExtracted)
    };
  };

  const roundData = formatRoundInfo();

  if (isSuccess) {
    return (
      <div className="tech-container">
        <div className="tech-text" style={{ textAlign: 'center' }}>
          <h2 className="tech-title" style={{ color: '#00ff66' }}>Action Completed Successfully!</h2>
          <p style={{ margin: '20px 0', fontSize: '18px' }}>
            Your action for Round #{roundId} has been executed.
          </p>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '30px' }}>
            <button className="tech-button" onClick={onBack}>
              Back to Dashboard
            </button>
            <button 
              className="tech-button" 
              onClick={() => {
                setSelectedAction(null);
                setRoundId('');
                setProfitAmount('');
                setError(null);
                setIsLoading(false);
              }}
            >
              Perform Another Action
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
          <h2 className="tech-title">Leader Actions</h2>
        </div>

        <p style={{ marginBottom: '30px', opacity: 0.8 }}>
          Manage your trading rounds: stop deposits, extract funds, and distribute profits.
        </p>

        {!address ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p className="tech-subtitle">Connect your wallet to manage trading rounds</p>
          </div>
        ) : (
          <div style={{ maxWidth: '700px' }}>
            {/* Round Selection */}
            <div style={{ marginBottom: '30px' }}>
              <label className="tech-text" style={{ display: 'block', marginBottom: '8px', fontSize: '16px' }}>
                Select Round ID
              </label>
              <input
                type="number"
                min="1"
                max={currentRoundId ? Number(currentRoundId) : undefined}
                value={roundId}
                onChange={(e) => setRoundId(e.target.value)}
                className="tech-input"
                placeholder="Enter round ID to manage"
                disabled={isLoading || isConfirming}
              />
              {currentRoundId ? (
                <p style={{ fontSize: '12px', opacity: 0.6, marginTop: '5px' }}>
                  Latest round ID: {Number(currentRoundId)}
                </p>
              ) : null}
            </div>

            {/* Round Information */}
            {roundData && (
              <div style={{ marginBottom: '30px', padding: '20px', background: 'rgba(0, 255, 0, 0.05)', borderRadius: '8px', border: '1px solid rgba(0, 255, 0, 0.2)' }}>
                <h4 style={{ marginBottom: '15px', color: '#00ff66' }}>Round #{roundId} Status</h4>
                
                {!roundData.isUserLeader && (
                  <div className="error-message" style={{ marginBottom: '15px' }}>
                    ⚠️ You are not the leader of this round
                  </div>
                )}

                <div style={{ display: 'grid', gap: '8px', fontSize: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ opacity: 0.8 }}>Leader:</span>
                    <span style={{ fontFamily: 'monospace' }}>
                      {roundData.isUserLeader ? 'YOU' : `${roundData.leader.slice(0, 6)}...${roundData.leader.slice(-4)}`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ opacity: 0.8 }}>Target Amount:</span>
                    <span>{roundData.targetAmountFormatted} cUSDT</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ opacity: 0.8 }}>Followers:</span>
                    <span>{roundData.followerCount}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ opacity: 0.8 }}>Deposits Enabled:</span>
                    <span className={roundData.depositsEnabled ? 'status-active' : 'status-inactive'}>
                      {roundData.depositsEnabled ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ opacity: 0.8 }}>Round Status:</span>
                    <span className={roundData.isActive ? 'status-active' : 'status-inactive'}>
                      {roundData.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ opacity: 0.8 }}>Time Status:</span>
                    <span className={roundData.hasEnded ? 'status-completed' : 'status-active'}>
                      {roundData.hasEnded ? 'Ended' : `${Math.floor(roundData.timeRemaining / 86400)}d ${Math.floor((roundData.timeRemaining % 86400) / 3600)}h remaining`}
                    </span>
                  </div>
                  
                  {roundData.decryptedTotalDeposited > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ opacity: 0.8 }}>Total Deposited:</span>
                      <span>{roundData.decryptedTotalDeposited.toLocaleString()} cUSDT</span>
                    </div>
                  )}
                  
                  {roundData.decryptedTotalProfit > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ opacity: 0.8 }}>Total Profit:</span>
                      <span>{roundData.decryptedTotalProfit.toLocaleString()} cUSDT</span>
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ opacity: 0.8 }}>Funds Extracted:</span>
                    <span className={roundData.fundsExtracted ? 'status-active' : 'status-inactive'}>
                      {roundData.fundsExtracted ? 'Yes' : 'No'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ opacity: 0.8 }}>Operator Set:</span>
                    <span className={isOperatorSet ? 'status-active' : 'status-inactive'}>
                      {isOperatorSet ? 'Yes' : 'No'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ opacity: 0.8 }}>Profit Distributed:</span>
                    <span className={roundData.isProfitDistributed ? 'status-completed' : 'status-inactive'}>
                      {roundData.isProfitDistributed ? 'Yes' : 'No'}
                    </span>
                  </div>

                  {/* Display encrypted total profit */}
                  {encryptedTotalProfit && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ opacity: 0.8 }}>Total Profit:</span>
                      {isZeroValue ? (
                        <span>0 cUSDT</span>
                      ) : isProfitDecrypting ? (
                        <span style={{ fontSize: '12px', color: '#ffa500' }}>🔓 Decrypting...</span>
                      ) : profitDecryptionError ? (
                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: '#ff6b6b' }}>❌ Failed</span>
                          <button
                            onClick={decryptProfit}
                            style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              background: 'rgba(0, 255, 102, 0.2)',
                              border: '1px solid rgba(0, 255, 102, 0.5)',
                              borderRadius: '3px',
                              color: '#00ff66',
                              cursor: 'pointer'
                            }}
                          >
                            Retry
                          </button>
                        </div>
                      ) : decryptedProfit ? (
                        <span style={{ color: '#00ff66' }}>{decryptedProfit} cUSDT</span>
                      ) : (
                        <button
                          onClick={decryptProfit}
                          style={{
                            fontSize: '12px',
                            padding: '4px 8px',
                            background: 'rgba(0, 255, 102, 0.2)',
                            border: '1px solid rgba(0, 255, 102, 0.5)',
                            borderRadius: '4px',
                            color: '#00ff66',
                            cursor: 'pointer'
                          }}
                        >
                          🔓 Decrypt
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Selection */}
            {roundData && roundData.isUserLeader && (
              <>
                <div style={{ marginBottom: '30px' }}>
                  <h4 style={{ marginBottom: '15px', color: '#00ff66' }}>Available Actions</h4>
                  <div style={{ display: 'grid', gap: '15px', gridTemplateColumns: '1fr 1fr' }}>
                    <button
                      className={`tech-button ${selectedAction === 'stop-deposits' ? 'active' : ''}`}
                      onClick={() => setSelectedAction('stop-deposits')}
                      disabled={!roundData.depositsEnabled || isLoading || isConfirming}
                      style={{ 
                        opacity: !roundData.depositsEnabled ? 0.5 : 1,
                        cursor: !roundData.depositsEnabled ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Stop Deposits
                    </button>
                    
                    <button
                      className={`tech-button ${selectedAction === 'extract-funds' ? 'active' : ''}`}
                      onClick={() => setSelectedAction('extract-funds')}
                      disabled={roundData.depositsEnabled || roundData.fundsExtracted || isLoading || isConfirming}
                      style={{
                        opacity: (roundData.depositsEnabled || roundData.fundsExtracted) ? 0.5 : 1,
                        cursor: (roundData.depositsEnabled || roundData.fundsExtracted) ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Extract Funds
                    </button>
                    
                    <button
                      className={`tech-button ${selectedAction === 'deposit-profit' ? 'active' : ''}`}
                      onClick={() => setSelectedAction('deposit-profit')}
                      disabled={!roundData.fundsExtracted || roundData.isProfitDistributed || isLoading || isConfirming}
                      style={{
                        opacity: (!roundData.fundsExtracted || roundData.isProfitDistributed) ? 0.5 : 1,
                        cursor: (!roundData.fundsExtracted || roundData.isProfitDistributed) ? 'not-allowed' : 'pointer'
                      }}
                      title={!isOperatorSet ? 'Will set operator permission first, then deposit profit' : 'Deposit trading profits to the contract'}
                    >
                      Deposit Profit
                    </button>
                    
                    <button
                      className={`tech-button ${selectedAction === 'distribute-profit' ? 'active' : ''}`}
                      onClick={() => setSelectedAction('distribute-profit')}
                      disabled={!roundData.hasEnded || roundData.isProfitDistributed || isLoading || isConfirming}
                      style={{ 
                        opacity: (!roundData.hasEnded || roundData.isProfitDistributed) ? 0.5 : 1,
                        cursor: (!roundData.hasEnded || roundData.isProfitDistributed) ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Distribute Profit
                    </button>
                  </div>
                </div>

                {/* Action Form */}
                {selectedAction && (
                  <div style={{ marginBottom: '30px', padding: '20px', background: 'rgba(0, 50, 0, 0.3)', borderRadius: '8px', border: '1px solid rgba(0, 255, 0, 0.3)' }}>
                    <h4 style={{ marginBottom: '15px', color: '#00ff66' }}>
                      {selectedAction === 'stop-deposits' && 'Stop Deposits'}
                      {selectedAction === 'extract-funds' && 'Extract Funds'}
                      {selectedAction === 'deposit-profit' && 'Deposit Profit'}
                      {selectedAction === 'distribute-profit' && 'Distribute Profit'}
                    </h4>

                    <div style={{ marginBottom: '15px', fontSize: '14px', opacity: 0.8 }}>
                      {selectedAction === 'stop-deposits' && 'Stop accepting new deposits and prepare for fund extraction.'}
                      {selectedAction === 'extract-funds' && 'Extract all deposited funds to start trading. Deposits must be stopped first.'}
                      {selectedAction === 'deposit-profit' && 'Deposit trading profits back to the contract for distribution.'}
                      {selectedAction === 'distribute-profit' && 'Calculate and enable profit distribution to followers.'}
                    </div>

                    {selectedAction === 'deposit-profit' && (
                      <div style={{ marginBottom: '20px' }}>
                        <label className="tech-text" style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                          Profit Amount (cUSDT)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={profitAmount}
                          onChange={(e) => setProfitAmount(e.target.value)}
                          className="tech-input"
                          placeholder="Enter profit amount to distribute"
                          disabled={isLoading || isConfirming}
                        />
                      </div>
                    )}

                    {error && (
                      <div className="error-message" style={{ marginBottom: '20px' }}>
                        {error}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '15px' }}>
                      <button
                        className={`tech-button ${isLoading || isConfirming ? 'loading' : ''}`}
                        onClick={() => handleAction(selectedAction)}
                        disabled={
                          isLoading || 
                          isConfirming || 
                          (selectedAction === 'deposit-profit' && !profitAmount)
                        }
                        style={{ flex: 1 }}
                      >
                        {isConfirming 
                          ? 'Confirming...' 
                          : isLoading 
                            ? 'Processing...' 
                            : 'Execute Action'
                        }
                      </button>
                      <button
                        className="tech-button"
                        onClick={() => {
                          setSelectedAction(null);
                          setProfitAmount('');
                          setError(null);
                        }}
                        disabled={isLoading || isConfirming}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaderActions;