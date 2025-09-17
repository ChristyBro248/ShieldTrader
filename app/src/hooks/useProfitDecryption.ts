import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { getFHEVMInstance } from '../config/fhevm';
import { CONTRACTS } from '../config/contracts';

interface DecryptionState {
  decryptedProfit: string | null;
  isDecrypting: boolean;
  error: string | null;
}

export const useProfitDecryption = (encryptedProfitHandle: string | undefined, roundId: number) => {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [state, setState] = useState<DecryptionState>({
    decryptedProfit: null,
    isDecrypting: false,
    error: null,
  });
  const [lastDecryptedHandle, setLastDecryptedHandle] = useState<string | null>(null);

  const decryptProfit = useCallback(async () => {
    if (!encryptedProfitHandle || !address || !walletClient) {
      return;
    }

    setState(prev => ({ ...prev, isDecrypting: true, error: null }));

    try {
      const fhevmInstance = getFHEVMInstance();

      // Generate keypair for decryption
      const keypair = fhevmInstance.generateKeypair();

      // Prepare handle-contract pairs
      const handleContractPairs = [
        {
          handle: encryptedProfitHandle,
          contractAddress: CONTRACTS.LEAD_TRADING,
        },
      ];

      // Create timestamp and duration for EIP712
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = "10";
      const contractAddresses = [CONTRACTS.LEAD_TRADING];

      // Create EIP712 signature
      const eip712 = fhevmInstance.createEIP712(
        keypair.publicKey,
        contractAddresses,
        startTimeStamp,
        durationDays
      );

      const signature = await walletClient.signTypedData({
        domain: eip712.domain,
        types: {
          UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
        },
        primaryType: 'UserDecryptRequestVerification',
        message: eip712.message,
      });

      // Perform user decryption
      const result = await fhevmInstance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace("0x", ""),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays,
      );

      const decryptedValue = result[encryptedProfitHandle];
      const formattedProfit = (Number(decryptedValue) / Math.pow(10, 6)).toLocaleString();

      setState({
        decryptedProfit: formattedProfit,
        isDecrypting: false,
        error: null,
      });

      setLastDecryptedHandle(encryptedProfitHandle);

    } catch (error) {
      console.error('Failed to decrypt profit:', error);
      setState({
        decryptedProfit: null,
        isDecrypting: false,
        error: error instanceof Error ? error.message : 'Decryption failed',
      });
    }
  }, [encryptedProfitHandle, address, walletClient]);

  // Check if the encrypted handle represents zero value
  const isZeroValue = encryptedProfitHandle === '0x0000000000000000000000000000000000000000000000000000000000000000' ||
                      !encryptedProfitHandle ||
                      encryptedProfitHandle === '0x0000000000000000000000000000000000000000000000000000000000000000';

  return {
    ...state,
    isZeroValue,
    decrypt: decryptProfit,
  };
};