import { useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { CUSDT_ABI, CONTRACTS } from '../config/contracts';
import { getFHEVMInstance } from '../config/fhevm';

interface AssetsProps {
  onBack: () => void;
}

const Assets = ({ onBack }: AssetsProps) => {
  const { address } = useAccount();
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptedBalance, setDecryptedBalance] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get encrypted balance
  const { data: encryptedBalance, isLoading: balanceLoading } = useReadContract({
    address: CONTRACTS.CUSDT as `0x${string}`,
    abi: CUSDT_ABI,
    functionName: 'confidentialBalanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  const handleDecrypt = async () => {
    if (!encryptedBalance || !address) return;

    setIsDecrypting(true);
    setError(null);

    try {
      const instance = getFHEVMInstance();
      if (!instance) {
        throw new Error('FHEVM instance not available');
      }

      // User decryption process
      const keypair = instance.generateKeypair();
      const handleContractPairs = [
        {
          handle: encryptedBalance as string,
          contractAddress: CONTRACTS.CUSDT,
        },
      ];
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = "10";
      const contractAddresses = [CONTRACTS.CUSDT];

      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);

      // Get signer from wallet connection
      const { ethereum } = window as any;
      if (!ethereum) {
        throw new Error('No wallet found');
      }

      const provider = new (await import('ethers')).BrowserProvider(ethereum);
      const signer = await provider.getSigner();

      const signature = await signer.signTypedData(
        eip712.domain,
        {
          UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
        },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace("0x", ""),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays,
      );

      const decryptedValue = result[encryptedBalance as string];

      // Convert to readable format (cUSDT has 6 decimals)
      const balanceInTokens = (Number(decryptedValue) / 1000000).toFixed(6);
      setDecryptedBalance(balanceInTokens);

    } catch (err: any) {
      console.error('Decryption failed:', err);
      setError(err.message || 'Failed to decrypt balance');
    } finally {
      setIsDecrypting(false);
    }
  };

  const formatBalance = (balance: string | null) => {
    if (balance === null) return '***';
    return `${balance} cUSDT`;
  };

  return (
    <div className="tech-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2 className="tech-subtitle">My Assets</h2>
        <button className="tech-button" onClick={onBack}>
          Back
        </button>
      </div>

      <div className="tech-card">
        <h3 className="tech-subtitle" style={{ fontSize: '18px', marginBottom: '20px' }}>
          cUSDT Balance
        </h3>

        {!address ? (
          <p className="tech-text">Please connect your wallet to view assets</p>
        ) : balanceLoading ? (
          <p className="tech-text">Loading balance...</p>
        ) : !encryptedBalance ? (
          <p className="tech-text">No balance data available</p>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
              <span className="tech-text" style={{ fontSize: '24px', fontWeight: 'bold' }}>
                {formatBalance(decryptedBalance)}
              </span>

              {decryptedBalance === null && (
                <button
                  className="tech-button"
                  onClick={handleDecrypt}
                  disabled={isDecrypting}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    backgroundColor: isDecrypting ? '#666' : '#00ff00',
                    cursor: isDecrypting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isDecrypting ? 'Decrypting...' : 'Decrypt'}
                </button>
              )}

              {decryptedBalance !== null && (
                <button
                  className="tech-button"
                  onClick={() => {
                    setDecryptedBalance(null);
                    setError(null);
                  }}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    backgroundColor: '#ff4444'
                  }}
                >
                  Hide
                </button>
              )}
            </div>

            {error && (
              <div style={{
                padding: '10px',
                backgroundColor: 'rgba(255, 68, 68, 0.1)',
                border: '1px solid #ff4444',
                borderRadius: '5px',
                marginTop: '10px'
              }}>
                <p className="tech-text" style={{ color: '#ff4444', margin: 0 }}>
                  Error: {error}
                </p>
              </div>
            )}

            <div style={{ marginTop: '20px', fontSize: '12px', color: '#888' }}>
              <p>Encrypted Balance Handle: {encryptedBalance}</p>
              <p>Your encrypted balance is protected by FHE. Click "Decrypt" to view the actual amount.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Assets;