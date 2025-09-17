import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { LEAD_TRADING_ABI, CONTRACTS, CUSDT_ABI } from '../config/contracts';
import { parseUnits } from 'viem';
import { getFHEVMInstance } from '../config/fhevm';

interface JoinRoundProps {
  onBack: () => void;
  prefilledRoundId?: number;
}

const JoinRound = ({ onBack, prefilledRoundId }: JoinRoundProps) => {
  const { address } = useAccount();
  const [roundId, setRoundId] = useState(prefilledRoundId ? prefilledRoundId.toString() : '');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'approve' | 'join'>('approve');
  const [operatorApproved, setOperatorApproved] = useState(false);

  const { writeContract, data: hash, error: writeError } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
  });

  // Handle transaction success
  useEffect(() => {
    if (isSuccess && receipt && hash) {
      console.log('=== JoinRound: Transaction confirmed ===');
      console.log('JoinRound: Transaction hash:', hash);
      console.log('JoinRound: Receipt:', receipt);
      console.log('JoinRound: Block number:', receipt.blockNumber);
      console.log('JoinRound: Gas used:', receipt.gasUsed.toString());
      console.log('JoinRound: Current step when transaction confirmed:', step);

      if (step === 'approve') {
        console.log('JoinRound: Operator approval confirmed, proceeding to join step');
        setOperatorApproved(true);
        setStep('join');
        setIsLoading(false);
        setError(null);
      } else if (step === 'join') {
        console.log('JoinRound: Join round confirmed');
        setIsLoading(false);
        // Keep the success state - user will see success page
      }
    }
  }, [isSuccess, receipt, hash, step]);

  // Handle write contract success
  useEffect(() => {
    if (hash) {
      console.log('=== JoinRound: Transaction submitted ===');
      console.log('JoinRound: Transaction hash:', hash);
      console.log('JoinRound: Waiting for confirmation...');
    }
  }, [hash]);

  // Handle write contract errors
  useEffect(() => {
    if (writeError) {
      console.error('=== JoinRound: Transaction submission failed ===');
      console.error('JoinRound: Submission error:', writeError);
      setIsLoading(false);
      setError(writeError.message || 'Failed to submit transaction');
    }
  }, [writeError]);

  // Handle transaction timeout
  useEffect(() => {
    if (hash && !isConfirming && !isSuccess && !receipt) {
      // Transaction might have failed - but let's wait a bit more
      const timeout = setTimeout(() => {
        console.error('=== JoinRound: Transaction seems to have failed ===');
        console.error('JoinRound: Hash:', hash);
        setIsLoading(false);
        setError('Transaction may have failed - please check your wallet');
      }, 30000); // Wait 30 seconds before assuming failure

      return () => clearTimeout(timeout);
    }
  }, [hash, isConfirming, isSuccess, receipt]);

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

  // Check if user has already set operator for the contract
  const { data: isOperatorSet } = useReadContract({
    address: CONTRACTS.CUSDT as `0x${string}`,
    abi: CUSDT_ABI,
    functionName: 'isOperator',
    args: address && CONTRACTS.LEAD_TRADING ? [address, CONTRACTS.LEAD_TRADING as `0x${string}`] : undefined,
  });

  // Log contract data when loaded
  if (currentRoundId) {
    console.log('JoinRound: Current round ID:', currentRoundId.toString());
  }

  if (roundInfo && roundId) {
    console.log('JoinRound: Round info for round', roundId, ':', roundInfo);
  }

  // Check if operator is already set and still valid
  useEffect(() => {
    if (address) {
      const operatorValid = Boolean(isOperatorSet);

      console.log('JoinRound: IsOperator result:', isOperatorSet);
      console.log('JoinRound: Operator valid:', operatorValid);

      if (operatorValid) {
        console.log('JoinRound: Operator already set and valid, skipping to join step');
        setOperatorApproved(true);
        setStep('join');
      } else {
        console.log('JoinRound: Operator not set, staying on approve step');
        setOperatorApproved(false);
        setStep('approve');
      }
    }
  }, [isOperatorSet, address]);

  // Debug state changes
  console.log('JoinRound: Current state - step:', step, 'operatorApproved:', operatorApproved, 'isLoading:', isLoading, 'isConfirming:', isConfirming);
  console.log('JoinRound: IsOperator value:', isOperatorSet);

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('=== JoinRound: Starting approval process ===');

    if (!address) {
      console.log('JoinRound: No wallet address found');
      setError('Please connect your wallet');
      return;
    }

    try {
      setError(null);
      setIsLoading(true);
      console.log('JoinRound: Starting operator approval');

      const until = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 hours
      console.log('JoinRound: Setting operator until:', until);

      writeContract({
        address: CONTRACTS.CUSDT as `0x${string}`,
        abi: CUSDT_ABI,
        functionName: 'setOperator',
        args: [CONTRACTS.LEAD_TRADING as `0x${string}`, until]
      });

      console.log('JoinRound: Operator approval initiated');

    } catch (err) {
      console.error('=== JoinRound: Approval error ===');
      console.error('JoinRound: Error details:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve operator');
      setIsLoading(false);
    }
  };

  const handleJoinRound = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('=== JoinRound: Starting join round process ===');

    if (!address) {
      console.log('JoinRound: No wallet address found');
      setError('Please connect your wallet');
      return;
    }

    if (!roundId || !amount) {
      console.log('JoinRound: Missing required fields - roundId:', roundId, 'amount:', amount);
      setError('Please fill in all fields');
      return;
    }

    const amountNum = parseFloat(amount);
    const roundIdNum = parseInt(roundId);
    console.log('JoinRound: Parsed values - amountNum:', amountNum, 'roundIdNum:', roundIdNum);

    if (amountNum <= 0) {
      console.log('JoinRound: Invalid amount - must be greater than 0');
      setError('Amount must be greater than 0');
      return;
    }

    if (roundIdNum <= 0 || (currentRoundId && roundIdNum > Number(currentRoundId))) {
      console.log('JoinRound: Invalid round ID - roundIdNum:', roundIdNum, 'currentRoundId:', currentRoundId);
      setError('Invalid round ID');
      return;
    }

    console.log('JoinRound: All validation checks passed');

    try {
      setError(null);
      setIsLoading(true);
      console.log('JoinRound: Starting transaction process');

      // Get FHEVM instance
      console.log('JoinRound: Getting FHEVM instance');
      const fhevmInstance = getFHEVMInstance();
      console.log('JoinRound: FHEVM instance obtained:', !!fhevmInstance);

      // Create encrypted input for the amount
      console.log('JoinRound: Creating encrypted input for contract:', CONTRACTS.LEAD_TRADING, 'user:', address);
      const input = fhevmInstance.createEncryptedInput(
        CONTRACTS.LEAD_TRADING,
        address
      );
      console.log('JoinRound: Encrypted input created');

      // Convert amount to proper units (6 decimals for USDT)
      const amountInUnits = parseUnits(amount, 6);
      console.log('JoinRound: Amount converted to units - original:', amount, 'units:', amountInUnits.toString());

      input.add64(amountInUnits);
      console.log('JoinRound: Amount added to encrypted input');

      // Encrypt the input
      console.log('JoinRound: Starting encryption process');
      const encryptedInput = await input.encrypt();
      console.log('JoinRound: Encryption completed');
      console.log('JoinRound: Encrypted input handles:', encryptedInput.handles);
      console.log('JoinRound: Input proof length:', encryptedInput.inputProof?.length);

      // Ensure we have valid data before calling writeContract
      if (!encryptedInput.handles[0] || !encryptedInput.inputProof) {
        throw new Error('Invalid encrypted input data');
      }

      console.log('JoinRound: About to call writeContract for joinRound');
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
      console.log('JoinRound: joinRound writeContract called');

    } catch (err) {
      console.error('=== JoinRound: Join round error ===');
      console.error('JoinRound: Error details:', err);
      console.error('JoinRound: Error stack:', err instanceof Error ? err.stack : 'No stack trace');
      console.error('JoinRound: Error message:', err instanceof Error ? err.message : 'Unknown error');

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

        {/* Step indicator */}
        <div style={{ marginBottom: '30px', padding: '20px', background: 'rgba(0, 255, 102, 0.05)', borderRadius: '8px', border: '1px solid rgba(0, 255, 102, 0.2)' }}>
          <h4 style={{ marginBottom: '15px', color: '#00ff66' }}>
            Step {step === 'approve' ? '1' : '2'} of 2: {step === 'approve' ? 'Approve Token Transfer' : 'Join Round'}
          </h4>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <div style={{
              padding: '8px 12px',
              borderRadius: '4px',
              backgroundColor: step === 'approve' ? '#00ff66' : operatorApproved ? '#666666' : '#333333',
              color: step === 'approve' ? '#000000' : '#ffffff',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              1. Approve
            </div>
            <div style={{ width: '20px', height: '2px', backgroundColor: operatorApproved ? '#00ff66' : '#333333' }}></div>
            <div style={{
              padding: '8px 12px',
              borderRadius: '4px',
              backgroundColor: step === 'join' ? '#00ff66' : '#333333',
              color: step === 'join' ? '#000000' : '#ffffff',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              2. Join Round
            </div>
          </div>
          <p style={{ fontSize: '12px', marginTop: '10px', opacity: 0.8 }}>
            {step === 'approve'
              ? 'First, approve the contract to transfer your cUSDT tokens'
              : 'Now you can join the trading round with your encrypted deposit'
            }
          </p>
        </div>

        {!address ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p className="tech-subtitle">Connect your wallet to join a trading round</p>
          </div>
        ) : (
          <form onSubmit={step === 'approve' ? handleApprove : handleJoinRound} style={{ maxWidth: '600px' }}>
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
                disabled={!!prefilledRoundId || isLoading || isConfirming}
                style={{
                  ...(prefilledRoundId && {
                    backgroundColor: 'rgba(0, 255, 102, 0.1)',
                    border: '1px solid rgba(0, 255, 102, 0.3)',
                    color: '#00ff66'
                  })
                }}
                className="tech-input"
                placeholder="e.g., 1"
              />
              {prefilledRoundId ? (
                <p style={{ fontSize: '12px', color: '#00ff66', marginTop: '5px' }}>
                  ✓ Round ID selected from Dashboard
                </p>
              ) : currentRoundId ? (
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
                  (step === 'approve' ? false : (!roundId || !amount)) ||
                  (roundData ? (!roundData.isActive || !roundData.depositsEnabled || roundData.hasEnded) : false)
                }
                style={{ flex: 1 }}
              >
                {isConfirming
                  ? 'Confirming...'
                  : isLoading
                    ? (step === 'approve' ? 'Approving...' : 'Joining...')
                    : (step === 'approve' ? 'Approve cUSDT Transfer' : 'Join Round')
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