import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import { LEAD_TRADING_ABI, CONTRACTS } from '../config/contracts';

interface DashboardProps {
  onNavigate: (view: 'dashboard' | 'create' | 'join' | 'leader' | 'faucet' | 'assets', roundId?: number) => void;
}

interface RoundInfo {
  leader: string;
  targetAmount: bigint;
  duration: bigint;
  startTime: bigint;
  endTime: bigint;
  isActive: boolean;
  isProfitDistributed: boolean;
  depositsEnabled: boolean;
  followerCount: bigint;
  unitProfitRate: bigint;
  decryptedTotalDeposited: bigint;
  decryptedTotalProfit: bigint;
  fundsExtracted?: boolean;
}

const Dashboard = ({ onNavigate }: DashboardProps) => {
  const { address } = useAccount();
  const [rounds, setRounds] = useState<{ id: number; info: RoundInfo }[]>([]);

  const { data: currentRoundId } = useReadContract({
    address: CONTRACTS.LEAD_TRADING as `0x${string}`,
    abi: LEAD_TRADING_ABI,
    functionName: 'currentRoundId',
  });

  // Generate contracts array for batch reading - both round info and funds extracted status
  const contracts = currentRoundId ? (() => {
    const roundsToFetch = Math.min(Number(currentRoundId), 10);
    const startRound = Math.max(1, Number(currentRoundId) - roundsToFetch + 1);
    const contractCalls = [];

    for (let i = startRound; i <= Number(currentRoundId); i++) {
      // Add round info call
      contractCalls.push({
        address: CONTRACTS.LEAD_TRADING as `0x${string}`,
        abi: LEAD_TRADING_ABI,
        functionName: 'getRoundInfo',
        args: [BigInt(i)],
      });
      // Add funds extracted status call
      contractCalls.push({
        address: CONTRACTS.LEAD_TRADING as `0x${string}`,
        abi: LEAD_TRADING_ABI,
        functionName: 'isFundsExtracted',
        args: [BigInt(i)],
      });
    }
    return contractCalls;
  })() : [];

  const { data: roundsData, isLoading: roundsLoading } = useReadContracts({
    contracts,
    query: {
      enabled: !!currentRoundId && contracts.length > 0,
    },
  });

  useEffect(() => {
    if (!roundsData || !currentRoundId) {
      setRounds([]);
      return;
    }

    const roundData: { id: number; info: RoundInfo }[] = [];
    const roundsToFetch = Math.min(Number(currentRoundId), 10);
    const startRound = Math.max(1, Number(currentRoundId) - roundsToFetch + 1);

    // Process pairs of results (round info + funds extracted status)
    for (let i = 0; i < roundsData.length; i += 2) {
      const roundInfoResult = roundsData[i];
      const fundsExtractedResult = roundsData[i + 1];

      if (roundInfoResult?.status === 'success' && roundInfoResult.result &&
          fundsExtractedResult?.status === 'success') {
        const roundIndex = Math.floor(i / 2);
        const roundId = startRound + roundIndex;
        const data = roundInfoResult.result as unknown as any[];
        const fundsExtracted = Boolean(fundsExtractedResult.result);

        const info: RoundInfo = {
          leader: data[0],
          targetAmount: data[1],
          duration: data[2],
          startTime: data[3],
          endTime: data[4],
          isActive: data[5],
          isProfitDistributed: data[6],
          depositsEnabled: data[7],
          followerCount: data[8],
          unitProfitRate: data[9],
          decryptedTotalDeposited: data[10],
          decryptedTotalProfit: data[11],
          fundsExtracted: fundsExtracted,
        };

        roundData.push({ id: roundId, info });
      }
    }

    setRounds(roundData.reverse()); // Show newest first
  }, [roundsData, currentRoundId]);

  const formatAmount = (amount: bigint) => {
    return (Number(amount) / Math.pow(10, 6)).toLocaleString() + ' cUSDT';
  };

  const formatDuration = (seconds: bigint) => {
    const days = Number(seconds) / 86400;
    return `${days.toFixed(1)} days`;
  };

  const getTimeRemaining = (endTime: bigint) => {
    const now = Math.floor(Date.now() / 1000);
    const remaining = Number(endTime) - now;
    if (remaining <= 0) return 'Ended';
    
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    return `${days}d ${hours}h remaining`;
  };

  const getRoundStatus = (info: RoundInfo) => {
    const now = Math.floor(Date.now() / 1000);
    const hasEnded = now >= Number(info.endTime);

    // Debug info - remove this later
    console.log('Round status debug:', {
      isProfitDistributed: info.isProfitDistributed,
      isActive: info.isActive,
      depositsEnabled: info.depositsEnabled,
      fundsExtracted: info.fundsExtracted,
      hasEnded,
      endTime: Number(info.endTime),
      now
    });

    if (info.isProfitDistributed) return { text: 'Completed ✅', class: 'status-completed' };
    if (!info.isActive) return { text: 'Inactive ❌', class: 'status-inactive' };

    // If funds were extracted and time is close to ending or ended, leader should deposit profit
    if (info.fundsExtracted && (hasEnded || (Number(info.endTime) - now) < 7 * 24 * 3600)) {
      return { text: '🔸 Ready for Profit Deposit', class: 'status-warning' };
    }

    if (info.fundsExtracted) return { text: '🔄 Trading in Progress', class: 'status-active' };
    if (!info.depositsEnabled) return { text: '🔄 Preparing for Trading', class: 'status-active' };
    return { text: '📥 Open for Deposits', class: 'status-active' };
  };

  return (
    <div className="tech-container">
      <div className="tech-text">
        <h2 className="tech-title">Trading Rounds Dashboard</h2>
        <p style={{ marginBottom: '30px', opacity: 0.8 }}>
          Monitor active trading rounds and their performance
        </p>

        {!address ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p className="tech-subtitle">Connect your wallet to view trading rounds</p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '30px', textAlign: 'center' }}>
            
            </div>

            {roundsLoading ? (
              <div className="loading" style={{ textAlign: 'center', padding: '40px' }}>
                <p>Loading trading rounds...</p>
              </div>
            ) : rounds.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <p className="tech-subtitle">No trading rounds found</p>
                <p style={{ opacity: 0.7, marginTop: '10px' }}>
                  Be the first to create a trading round!
                </p>
              </div>
            ) : (
              <div className="tech-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' }}>
                {rounds.map(({ id, info }) => {
                  const status = getRoundStatus(info);
                  const isUserLeader = address && info.leader.toLowerCase() === address.toLowerCase();
                  const canJoin = info.isActive && info.depositsEnabled && !isUserLeader;
                  
                  return (
                    <div 
                      key={id} 
                      className="tech-card"
                      onClick={() => canJoin && onNavigate('join', id)}
                      style={{
                        cursor: canJoin ? 'pointer' : 'default',
                        transition: 'all 0.2s ease',
                        border: canJoin ? '1px solid rgba(0, 255, 102, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                        ...(canJoin && {
                          ':hover': {
                            transform: 'translateY(-2px)',
                            border: '1px solid rgba(0, 255, 102, 0.5)',
                            boxShadow: '0 4px 20px rgba(0, 255, 102, 0.1)'
                          }
                        })
                      }}
                      onMouseEnter={(e) => {
                        if (canJoin) {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.border = '1px solid rgba(0, 255, 102, 0.5)';
                          e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 255, 102, 0.1)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (canJoin) {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.border = '1px solid rgba(0, 255, 102, 0.3)';
                          e.currentTarget.style.boxShadow = 'none';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h3 className="tech-subtitle">Round #{id}</h3>
                        <span className={`tech-text ${status.class}`}>{status.text}</span>
                      </div>

                      <div style={{ display: 'grid', gap: '8px', fontSize: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ opacity: 0.8 }}>Leader:</span>
                          <span style={{ fontFamily: 'monospace' }}>
                            {isUserLeader ? 'YOU' : `${info.leader.slice(0, 6)}...${info.leader.slice(-4)}`}
                          </span>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ opacity: 0.8 }}>Target Amount:</span>
                          <span>{formatAmount(info.targetAmount)}</span>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ opacity: 0.8 }}>Duration:</span>
                          <span>{formatDuration(info.duration)}</span>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ opacity: 0.8 }}>Followers:</span>
                          <span>{Number(info.followerCount)}</span>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ opacity: 0.8 }}>Time Status:</span>
                          <span style={{ fontSize: '12px' }}>{getTimeRemaining(info.endTime)}</span>
                        </div>
                        
                        {info.decryptedTotalDeposited > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ opacity: 0.8 }}>Total Deposited:</span>
                            <span>{formatAmount(info.decryptedTotalDeposited)}</span>
                          </div>
                        )}
                        
                        {info.unitProfitRate > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ opacity: 0.8 }}>Profit Rate:</span>
                            <span>{((Number(info.unitProfitRate) / Math.pow(10, 18)) * 100).toFixed(2)}%</span>
                          </div>
                        )}
                      </div>

                      {isUserLeader ? (
                        <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(0, 255, 0, 0.1)', borderRadius: '4px' }}>
                          <p style={{ fontSize: '12px', color: '#00ff66' }}>
                            ⚡ You are the leader of this round
                          </p>
                          {(() => {
                            const now = Math.floor(Date.now() / 1000);
                            const hasEnded = now >= Number(info.endTime);
                            const timeRemaining = Number(info.endTime) - now;
                            const daysRemaining = Math.floor(timeRemaining / (24 * 3600));

                            if (info.isProfitDistributed) {
                              return (
                                <p style={{ fontSize: '11px', color: '#888', marginTop: '5px' }}>
                                  Round completed - profits distributed
                                </p>
                              );
                            } else if (info.fundsExtracted && (hasEnded || daysRemaining <= 7)) {
                              return (
                                <p style={{ fontSize: '11px', color: '#ffa500', marginTop: '5px' }}>
                                  🚨 Time to deposit profit and distribute to followers!
                                </p>
                              );
                            } else if (info.fundsExtracted) {
                              return (
                                <p style={{ fontSize: '11px', color: '#00ff66', marginTop: '5px' }}>
                                  💰 Funds extracted - Trading in progress ({daysRemaining}d remaining)
                                </p>
                              );
                            } else if (!info.depositsEnabled) {
                              return (
                                <p style={{ fontSize: '11px', color: '#ffa500', marginTop: '5px' }}>
                                  ⚡ Ready to extract funds for trading
                                </p>
                              );
                            } else {
                              return (
                                <p style={{ fontSize: '11px', color: '#888', marginTop: '5px' }}>
                                  Collecting deposits from followers
                                </p>
                              );
                            }
                          })()}
                        </div>
                      ) : canJoin ? (
                        <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(0, 255, 102, 0.1)', borderRadius: '4px', textAlign: 'center' }}>
                          <p style={{ fontSize: '12px', color: '#00ff66' }}>
                            👆 Click to join this round
                          </p>
                        </div>
                      ) : !info.isActive ? (
                        <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', textAlign: 'center' }}>
                          <p style={{ fontSize: '12px', color: '#888' }}>
                            Round is not active
                          </p>
                        </div>
                      ) : !info.depositsEnabled ? (
                        <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(255, 165, 0, 0.1)', borderRadius: '4px', textAlign: 'center' }}>
                          <p style={{ fontSize: '12px', color: '#ffa500' }}>
                            Deposits closed - Trading in progress
                          </p>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;