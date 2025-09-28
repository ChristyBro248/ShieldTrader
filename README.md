# 🛡️ ShieldTrader

**FHE-Powered Lead Trading Protocol**

[![Solidity](https://img.shields.io/badge/Solidity-^0.8.24-blue.svg)](https://docs.soliditylang.org/)
[![Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-yellow.svg)](https://hardhat.org/)
[![Zama FHE](https://img.shields.io/badge/Powered%20by-Zama%20FHE-green.svg)](https://docs.zama.ai/)
[![React](https://img.shields.io/badge/Frontend-React-blue.svg)](https://reactjs.org/)
[![License](https://img.shields.io/badge/License-BSD--3--Clause--Clear-blue.svg)](LICENSE)

ShieldTrader is a revolutionary decentralized trading platform that leverages Fully Homomorphic Encryption (FHE) to enable confidential lead trading. Users can participate in trading rounds where all financial data remains encrypted on-chain, ensuring complete privacy while maintaining transparency and security.

## 🎯 Vision & Problem Statement

### The Problem
Traditional trading platforms and copy-trading services suffer from several critical issues:
- **Lack of Privacy**: All trading amounts and profits are visible on-chain
- **Trust Issues**: Followers must trust leaders with their funds without oversight
- **Front-running Risks**: Public transaction data can be exploited
- **Centralized Control**: Most platforms require centralized custody of funds

### Our Solution
ShieldTrader solves these problems using cutting-edge Fully Homomorphic Encryption:
- **Complete Privacy**: All deposit amounts and profits remain encrypted
- **Trustless Operations**: Smart contracts enforce fair profit distribution
- **MEV Protection**: Encrypted transactions prevent front-running
- **Decentralized**: No central authority controls user funds

## ✨ Key Features

### 🔐 Privacy-First Architecture
- **Encrypted Deposits**: All user contributions are hidden using FHE
- **Confidential Profits**: Trading results remain private until distribution
- **Anonymous Participation**: Join rounds without revealing your investment size
- **MEV Resistance**: Encrypted transactions prevent malicious extraction

### 🎯 Lead Trading System
- **Round-Based Trading**: Time-bounded trading sessions with clear objectives
- **Flexible Parameters**: Leaders set target amounts and duration (1-365 days)
- **Automated Profit Distribution**: Smart contract calculates and distributes returns
- **Emergency Safeguards**: Automatic fund recovery after extended periods

### 🛡️ Security & Trust
- **Non-Custodial**: Users maintain control of their funds
- **Smart Contract Auditable**: Open-source, verifiable logic
- **Encrypted State**: All sensitive data protected by FHE
- **Reentrancy Protection**: Built-in security against common attacks

### 🎮 User Experience
- **Intuitive Interface**: Clean, responsive web application
- **Real-time Status**: Live updates on round progress and FHE status
- **Multi-Wallet Support**: Integration with popular Web3 wallets
- **Test Environment**: Comprehensive testnet support with faucet

## 🏗️ How It Works

### For Leaders (Trading Experts)
1. **Create Trading Round**: Set target amount, duration, and trading strategy
2. **Wait for Participants**: Followers join with encrypted contributions
3. **Extract Funds**: Once enough participants join, extract funds for trading
4. **Execute Strategy**: Trade using your expertise and preferred platforms
5. **Deposit Profits**: Return original capital plus profits to the contract
6. **Automatic Distribution**: Smart contract calculates and distributes returns

### For Followers (Investors)
1. **Browse Rounds**: Explore active trading rounds and leader statistics
2. **Join Round**: Contribute encrypted amounts to promising rounds
3. **Wait for Results**: Leaders execute trading strategies
4. **Receive Returns**: Automatically receive proportional profits
5. **Privacy Maintained**: Your investment amounts remain confidential

### Privacy Protection Mechanism
```
User Deposit (1000 USDT) → FHE Encryption → Encrypted Storage
                                ↓
Trading Execution (Off-chain) ← Fund Extraction ← Leader Access
                                ↓
Profit Calculation → FHE Operations → Encrypted Distribution
                                ↓
User Withdrawal ← Decryption (User Only) ← Final Settlement
```

## 🛠️ Technology Stack

### Smart Contracts
- **Solidity ^0.8.24**: Core contract language
- **Zama FHEVM**: Fully Homomorphic Encryption support
- **OpenZeppelin**: Security and standard implementations
- **Hardhat**: Development and testing framework

### Frontend
- **React 18**: Modern UI framework
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and dev server
- **Rainbow Kit**: Web3 wallet connection
- **Wagmi**: React hooks for Ethereum
- **Viem**: TypeScript-first Ethereum library

### FHE Integration
- **Zama Relayer SDK**: Client-side FHE operations
- **TFHE Library**: Core cryptographic operations
- **Gateway Chain**: Decryption oracle services
- **KMS Network**: Key management system

## 📁 Project Architecture

```
ShieldTrader/
├── contracts/                 # Smart contract source files
│   ├── LeadTrading.sol       # Main trading logic contract
│   └── cUSDT.sol             # Confidential USDT token
├── app/                      # Frontend application
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── config/           # Configuration files
│   │   └── hooks/            # Custom React hooks
│   └── package.json
├── deploy/                   # Deployment scripts
├── tasks/                    # Hardhat custom tasks
├── test/                     # Comprehensive test suite
├── types/                    # TypeScript type definitions
├── docs/                     # Technical documentation
│   ├── zama_llm.md          # FHE development guide
│   └── zama_doc_relayer.md   # Relayer SDK documentation
├── hardhat.config.ts         # Hardhat configuration
└── CLAUDE.md                 # Development guidelines
```

## 🚀 Quick Start

### Prerequisites
- **Node.js**: Version 20 or higher
- **npm**: Package manager
- **Web3 Wallet**: MetaMask or compatible wallet

### Backend Setup

1. **Clone and Install**
   ```bash
   git clone https://github.com/your-repo/ShieldTrader.git
   cd ShieldTrader
   npm install
   ```

2. **Environment Configuration**
   ```bash
   # Create .env file
   cp .env.example .env

   # Set your private key for deployment
   echo "PRIVATE_KEY=your_private_key_here" >> .env

   # Set Alchemy API key for Sepolia access
   echo "Alchemy_API_KEY=your_alchemy_key_here" >> .env
   ```

3. **Compile Contracts**
   ```bash
   npm run compile
   ```

4. **Run Tests**
   ```bash
   npm run test
   ```

5. **Deploy to Sepolia**
   ```bash
   npx hardhat deploy --network sepolia
   ```

### Frontend Setup

1. **Navigate to Frontend**
   ```bash
   cd app
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```

3. **Open Application**
   Visit `http://localhost:5173` in your browser

## 🧪 Testing

### Contract Testing
```bash
# Run all contract tests
npm run test

# Run tests with coverage
npm run coverage

# Test on Sepolia testnet
npm run test:sepolia
```

### Frontend Testing
```bash
cd app
npm run lint
npm run build
```

## 📜 Available Scripts

### Root Directory
| Script | Description |
|--------|-------------|
| `npm run compile` | Compile smart contracts |
| `npm run test` | Run contract tests |
| `npm run test:sepolia` | Test on Sepolia network |
| `npm run coverage` | Generate test coverage |
| `npm run lint` | Run linting checks |
| `npm run clean` | Clean build artifacts |
| `npm run typechain` | Generate TypeScript types |

### Frontend (app/)
| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Lint frontend code |

## 🔧 Contract Interfaces

### LeadTrading Contract

#### Core Functions
```solidity
// Create a new trading round
function createTradingRound(uint256 targetAmount, uint256 duration) external

// Join a round with encrypted deposit
function joinRound(uint256 roundId, externalEuint64 encryptedAmount, bytes calldata proof) external

// Leader extracts funds for trading
function extractFunds(uint256 roundId) external

// Deposit trading profits
function depositProfit(uint256 roundId, externalEuint64 encryptedProfit, bytes calldata proof) external

// Distribute profits to participants
function distributeProfit(uint256 roundId) external

// Withdraw returns (deposit + profit)
function withdrawProfit(uint256 roundId) external
```

#### View Functions
```solidity
// Get round information
function getRoundInfo(uint256 roundId) external view returns (...)

// Get follower deposit info
function getFollowerInfo(uint256 roundId, address follower) external view returns (...)

// Get encrypted total amounts
function getTotalDeposited(uint256 roundId) external view returns (euint64)
function getTotalProfit(uint256 roundId) external view returns (euint64)
```

## 🌐 Deployment

### Sepolia Testnet
The protocol is deployed on Sepolia testnet for testing:

- **Network**: Sepolia (Chain ID: 11155111)
- **FHE Support**: Enabled via Zama infrastructure
- **Test Tokens**: Available through built-in faucet

### Mainnet Considerations
- **Gas Optimization**: FHE operations require careful gas management
- **Security Audits**: Professional security review recommended
- **Gradual Rollout**: Consider beta testing with limited participants

## 🔒 Security Features

### FHE Security
- **Threshold Encryption**: No single point of decryption
- **Access Control Lists**: Granular permission management
- **Reorg Protection**: Built-in protection against chain reorganizations
- **Type Safety**: Strongly typed encrypted operations

### Smart Contract Security
- **Reentrancy Guards**: Protection against reentrancy attacks
- **Access Controls**: Role-based permission system
- **Input Validation**: Comprehensive parameter checking
- **Emergency Functions**: Safeguards for exceptional situations

### Privacy Guarantees
- **Input Privacy**: Deposit amounts never revealed
- **Computation Privacy**: Operations on encrypted data
- **Output Privacy**: Results encrypted until authorized
- **Metadata Privacy**: Transaction patterns obscured

## 🎯 Use Cases

### For Professional Traders
- **Attract Followers**: Build a following without revealing strategy details
- **Monetize Expertise**: Earn from successful trading strategies
- **Risk Management**: Limited exposure through structured rounds
- **Reputation Building**: Transparent performance tracking

### For Investors
- **Copy Trading**: Follow successful traders without revealing capital
- **Risk Diversification**: Spread investments across multiple leaders
- **Privacy Protection**: Keep investment amounts confidential
- **Reduced Barriers**: Access professional trading strategies

### For Institutions
- **Confidential Trading**: Execute large orders without market impact
- **Compliance**: Maintain regulatory compliance with privacy
- **Risk Assessment**: Evaluate strategies without exposure
- **Competitive Advantage**: Protect proprietary trading methods

## 🚧 Current Limitations

### Technical Constraints
- **Gas Costs**: FHE operations are more expensive than plaintext
- **Network Support**: Limited to FHE-enabled networks
- **Processing Time**: Encrypted operations require additional time
- **Development Complexity**: FHE requires specialized knowledge

### Feature Limitations
- **Testnet Only**: Currently deployed on testnet
- **Single Asset**: Limited to USDT trading
- **Manual Profit Reporting**: Leaders must manually report results
- **Limited Analytics**: Encrypted data restricts analysis options

## 🗺️ Roadmap

### Phase 1: Core Protocol (Q1 2024) ✅
- ✅ FHE-enabled smart contracts
- ✅ Basic trading round functionality
- ✅ Web application interface
- ✅ Sepolia testnet deployment

### Phase 2: Enhanced Features (Q2 2024)
- 🔄 Multi-asset support (ETH, BTC, stablecoins)
- 🔄 Advanced analytics dashboard
- 🔄 Leader reputation system
- 🔄 Mobile application

### Phase 3: Mainnet & Scaling (Q3 2024)
- 📋 Security audit completion
- 📋 Mainnet deployment
- 📋 Layer 2 integration
- 📋 Institutional features

### Phase 4: Advanced Trading (Q4 2024)
- 📋 Automated strategy execution
- 📋 Cross-chain trading support
- 📋 Derivatives and leverage
- 📋 DAO governance implementation

### Phase 5: Ecosystem Expansion (2025)
- 📋 Partner integrations
- 📋 Advanced privacy features
- 📋 AI-powered trading insights
- 📋 Global market expansion

## 🤝 Contributing

We welcome contributions from the community! Please follow these guidelines:

### Development Process
1. **Fork the Repository**: Create your own fork
2. **Create Feature Branch**: `git checkout -b feature/amazing-feature`
3. **Follow Conventions**: Adhere to existing code style
4. **Write Tests**: Ensure comprehensive test coverage
5. **Submit PR**: Create a detailed pull request

### Code Standards
- **Solidity**: Follow industry best practices and security guidelines
- **TypeScript**: Use strict typing and modern ES6+ features
- **Testing**: Maintain 90%+ test coverage
- **Documentation**: Update docs for any new features

### Areas for Contribution
- **Smart Contract Optimization**: Gas efficiency improvements
- **Frontend Enhancements**: UI/UX improvements
- **Testing**: Additional test scenarios and edge cases
- **Documentation**: Tutorials and integration guides
- **Security**: Vulnerability research and fixes

## 📚 Documentation & Resources

### Technical Documentation
- [FHE Development Guide](docs/zama_llm.md) - Comprehensive FHE development guide
- [Relayer SDK Documentation](docs/zama_doc_relayer.md) - Frontend integration guide
- [Development Guidelines](CLAUDE.md) - Project-specific development rules

### External Resources
- [Zama FHEVM Documentation](https://docs.zama.ai/fhevm) - Official FHE documentation
- [Hardhat Documentation](https://hardhat.org/docs) - Development framework guide
- [React Documentation](https://reactjs.org/docs) - Frontend framework guide
- [Rainbow Kit Documentation](https://www.rainbowkit.com/docs) - Wallet integration guide

### Learning Resources
- [FHE Fundamentals](https://docs.zama.ai/protocol) - Understanding homomorphic encryption
- [Solidity by Example](https://solidity-by-example.org/) - Smart contract examples
- [Web3 Development](https://ethereum.org/en/developers/) - Ethereum development resources

## 🐛 Known Issues & Solutions

### Common Issues
1. **FHE Initialization Failure**
   - **Cause**: Network connectivity or browser compatibility
   - **Solution**: Refresh page, check browser console, ensure modern browser

2. **Transaction Failures**
   - **Cause**: Insufficient gas or network congestion
   - **Solution**: Increase gas limit, wait for network congestion to reduce

3. **Wallet Connection Issues**
   - **Cause**: Outdated wallet or network mismatch
   - **Solution**: Update wallet, ensure correct network selection

### Troubleshooting Guide
```bash
# Clear Hardhat cache
npm run clean

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Reset local development
npx hardhat node --reset
```

## 💼 Business Model

### Revenue Streams
1. **Protocol Fees**: Small percentage from successful trading rounds
2. **Premium Features**: Advanced analytics and institutional tools
3. **Partnership Revenue**: Integration fees from external platforms
4. **Governance Token**: Future token-based monetization

### Value Proposition
- **For Traders**: Monetize expertise while protecting strategies
- **For Investors**: Access professional trading with privacy
- **For Platform**: Sustainable fee-based revenue model
- **For Ecosystem**: Drive adoption of privacy-preserving DeFi

## 🎖️ Team & Acknowledgments

### Core Team
- **Smart Contract Development**: Blockchain engineers specializing in FHE
- **Frontend Development**: React and Web3 integration experts
- **Security Research**: Cryptography and smart contract security specialists
- **Product Design**: UX/UI designers focused on DeFi applications

### Special Thanks
- **Zama Team**: For pioneering FHE technology and providing excellent documentation
- **OpenZeppelin**: For secure smart contract libraries and standards
- **Hardhat Team**: For the excellent development framework
- **Community Contributors**: For testing, feedback, and improvements

## 📄 Legal & Compliance

### License
This project is licensed under the BSD-3-Clause-Clear License. See [LICENSE](LICENSE) for details.

### Disclaimers
- **Experimental Technology**: FHE is cutting-edge and may have limitations
- **Investment Risk**: Trading involves risk; past performance doesn't guarantee future results
- **Regulatory Compliance**: Users responsible for compliance with local regulations
- **No Financial Advice**: Platform provides tools, not investment recommendations

### Privacy Policy
- **Data Minimization**: Only necessary data collected
- **Encryption**: All sensitive data protected by FHE
- **No Personal Data**: Trading amounts and strategies remain private
- **User Control**: Users maintain control over their encrypted data

## 🆘 Support & Community

### Getting Help
- **Documentation**: Check comprehensive docs first
- **GitHub Issues**: [Report bugs or request features](https://github.com/your-repo/ShieldTrader/issues)
- **Discord Community**: Join our development community
- **Email Support**: support@shieldtrader.io

### Community Channels
- **Discord**: [Join our server](https://discord.gg/shieldtrader)
- **Twitter**: [@ShieldTrader](https://twitter.com/shieldtrader)
- **Telegram**: [ShieldTrader Community](https://t.me/shieldtrader)
- **Medium**: [Technical articles and updates](https://medium.com/@shieldtrader)

### Contributing Guidelines
See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed contribution guidelines.

---

**Built with 🛡️ by the ShieldTrader team, powered by Zama FHE technology**

*"Privacy-preserving DeFi for the next generation of traders"*
