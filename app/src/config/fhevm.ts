import { SepoliaConfig } from "@zama-fhe/relayer-sdk/bundle";

declare global {
  interface Window {
    fhevm: any;
  }
}

let fhevmInstance: any = null;

export const initFHEVM = async () => {
  if (fhevmInstance) return fhevmInstance;
  
  try {
    // Initialize the FHE SDK
    await window.fhevm.initSDK();
    
    // Create FHE instance with Sepolia config
    const config = { 
      ...SepoliaConfig, 
      network: window.ethereum 
    };
    
    fhevmInstance = await window.fhevm.createInstance(config);
    return fhevmInstance;
  } catch (error) {
    console.error('Failed to initialize FHEVM:', error);
    throw error;
  }
};

export const getFHEVMInstance = () => {
  if (!fhevmInstance) {
    throw new Error('FHEVM not initialized. Call initFHEVM() first.');
  }
  return fhevmInstance;
};