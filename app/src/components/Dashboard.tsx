import { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { LEAD_TRADING_ABI, CONTRACTS } from '../config/contracts';

interface DashboardProps {
  onNavigate: (view: 'dashboard' | 'create' | 'join' | 'leader' | 'faucet') => void;
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
}

const Dashboard = ({ onNavigate }: DashboardProps) => {
  const { address } = useAccount();
  const [rounds, setRounds] = useState<{ id: number; info: RoundInfo }[]>([]);
  const [loading, setLoading] = useState(true);

  const { data: currentRoundId } = useReadContract({
    address: CONTRACTS.LEAD_TRADING as `0x${string}`,
    abi: LEAD_TRADING_ABI,
    functionName: 'currentRoundId',
  });

  useEffect(() => {
    const fetchRounds = async () => {
      if (!currentRoundId || !CONTRACTS.LEAD_TRADING) return;
      
      setLoading(true);
      const roundData: { id: number; info: RoundInfo }[] = [];
      
      // Fetch recent rounds (last 10 or current round ID, whichever is smaller)
      const roundsToFetch = Math.min(Number(currentRoundId), 10);
      const startRound = Math.max(1, Number(currentRoundId) - roundsToFetch + 1);
      
      for (let i = startRound; i <= Number(currentRoundId); i++) {
        try {
          // This would need to be implemented with proper contract reading
          // For now, we'll just show placeholder data
          const mockInfo: RoundInfo = {
            leader: '0x' + Math.random().toString(16).substr(2, 40),
            targetAmount: BigInt(10000 * Math.pow(10, 6)),
            duration: BigInt(30 * 24 * 60 * 60),
            startTime: BigInt(Date.now() / 1000 - Math.random() * 86400 * 30),
            endTime: BigInt(Date.now() / 1000 + Math.random() * 86400 * 30),
            isActive: Math.random() > 0.3,
            isProfitDistributed: Math.random() > 0.7,
            depositsEnabled: Math.random() > 0.5,
            followerCount: BigInt(Math.floor(Math.random() * 50)),
            unitProfitRate: BigInt(Math.floor(Math.random() * 200000000000000000)), // Random profit rate
            decryptedTotalDeposited: BigInt(Math.floor(Math.random() * 10000 * Math.pow(10, 6))),
            decryptedTotalProfit: BigInt(Math.floor(Math.random() * 2000 * Math.pow(10, 6))),
          };
          
          roundData.push({ id: i, info: mockInfo });
        } catch (error) {
          console.error(`Error fetching round ${i}:`, error);
        }
      }
      
      setRounds(roundData.reverse()); // Show newest first
      setLoading(false);
    };

    fetchRounds();
  }, [currentRoundId]);

  const formatAmount = (amount: bigint) => {
    return (Number(amount) / Math.pow(10, 6)).toLocaleString() + ' USDT';
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
    if (info.isProfitDistributed) return { text: 'Completed', class: 'status-completed' };
    if (!info.isActive) return { text: 'Inactive', class: 'status-inactive' };
    if (!info.depositsEnabled) return { text: 'Trading', class: 'status-active' };
    return { text: 'Open for Deposits', class: 'status-active' };
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
              <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button 
                  className="tech-button"
                  onClick={() => onNavigate('create')}
                >
                  Create New Round
                </button>
                <button 
                  className="tech-button"
                  onClick={() => onNavigate('join')}
                >
                  Join Round
                </button>
                <button 
                  className="tech-button"
                  onClick={() => onNavigate('leader')}
                >
                  Manage Rounds
                </button>
              </div>
            </div>

            {loading ? (
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
                  
                  return (
                    <div key={id} className="tech-card">
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

                      {isUserLeader && (
                        <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(0, 255, 0, 0.1)', borderRadius: '4px' }}>
                          <p style={{ fontSize: '12px', color: '#00ff66' }}>
                            ⚡ You are the leader of this round
                          </p>
                        </div>
                      )}
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