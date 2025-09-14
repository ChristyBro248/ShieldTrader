# ShieldTrader Frontend

A React frontend for the ShieldTrader FHE-based lead trading system.

## Features

- **Tech-Inspired UI**: Cyberpunk/hacker aesthetic with green matrix-style design
- **FHE Integration**: Built-in support for Zama's FHEVM and encrypted operations  
- **Wallet Connection**: RainbowKit integration for seamless Web3 wallet connectivity
- **Lead Trading Functions**:
  - Create new trading rounds
  - Join existing rounds with encrypted deposits
  - Extract funds and manage rounds as a leader
  - Deposit profits and distribute returns

## Getting Started

### Prerequisites

- Node.js >= 16
- An Ethereum wallet (MetaMask, etc.)
- Access to Sepolia testnet

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file (optional):
```bash
cp .env.example .env
```

Edit `.env` to set your WalletConnect Project ID:
```
VITE_WALLET_CONNECT_PROJECT_ID=your_project_id_here
```

3. Update contract addresses in `src/config/contracts.ts`:
```typescript
export const CONTRACTS = {
  LEAD_TRADING: '0xYourDeployedLeadTradingAddress',
  CUSDT: '0xYourDeployedCUSDTAddress',
} as const;
```

4. Start development server:
```bash
npm run dev
```

5. Build for production:
```bash
npm run build
```

## Architecture

### Key Components

- **App.tsx**: Main application with routing and FHEVM initialization
- **Dashboard**: Overview of all trading rounds
- **CreateRound**: Interface for leaders to create new trading rounds
- **JoinRound**: Interface for followers to deposit encrypted USDT
- **LeaderActions**: Management interface for round leaders
- **WalletConnection**: Wallet connectivity using RainbowKit

### FHE Integration

The frontend uses Zama's FHEVM Relayer SDK for:
- Encrypting user inputs before sending to contract
- User decryption of private data
- Seamless integration with FHEVM contracts

### Styling

- Cyberpunk/tech aesthetic with matrix green color scheme
- Custom CSS with tech-inspired animations
- Responsive design for mobile and desktop

## Usage

1. **Connect Wallet**: Click "Connect Wallet" to connect your Ethereum wallet
2. **Create Round**: As a leader, set target amount and duration
3. **Join Round**: As a follower, deposit encrypted USDT into active rounds
4. **Manage Rounds**: Leaders can stop deposits, extract funds, and distribute profits
5. **Withdraw**: Followers can withdraw their proportional share after trading ends

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **RainbowKit** for wallet connectivity  
- **Wagmi** for Ethereum interactions
- **Viem** for Ethereum utilities
- **Zama FHEVM Relayer SDK** for encrypted computations

## Security

- All user deposits are encrypted using FHE
- Private keys never leave the user's wallet
- Smart contract handles all encrypted operations
- Access control ensures only authorized users can perform actions