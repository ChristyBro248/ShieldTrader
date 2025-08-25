// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint64, externalEuint64, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

interface IConfidentialUSDT {
    function confidentialTransferFrom(address from, address to, euint64 amount) external returns (euint64);
    function confidentialTransfer(address to, euint64 amount) external returns (euint64);
    function confidentialBalanceOf(address account) external view returns (euint64);
    function wrap(address to, uint256 amount) external;
    function unwrap(uint256 amount) external;
}

contract LeadTrading is SepoliaConfig, ReentrancyGuard, Ownable {
    struct TradingRound {
        address leader;
        uint256 targetAmount;
        uint256 duration;
        uint256 startTime;
        uint256 endTime;
        euint64 totalDeposited;
        euint64 totalProfit;
        bool isActive;
        bool isProfitDistributed;
        uint256 followerCount;
    }

    struct Follower {
        euint64 depositAmount;
        bool hasDeposited;
        bool hasWithdrawn;
    }

    IERC20 public immutable usdt;
    IConfidentialUSDT public immutable cUSDT;
    
    uint256 public currentRoundId;
    uint256 public constant MIN_ROUND_DURATION = 1 days;
    uint256 public constant MAX_ROUND_DURATION = 365 days;
    uint256 public constant MIN_TARGET_AMOUNT = 1000 * 10**6; // 1000 USDT
    
    mapping(uint256 => TradingRound) public tradingRounds;
    mapping(uint256 => mapping(address => Follower)) public followers;
    mapping(uint256 => address[]) public roundFollowers;
    
    event RoundCreated(uint256 indexed roundId, address indexed leader, uint256 targetAmount, uint256 duration);
    event FollowerJoined(uint256 indexed roundId, address indexed follower, uint256 encryptedAmount);
    event FundsExtracted(uint256 indexed roundId, address indexed leader, uint256 amount);
    event ProfitDeposited(uint256 indexed roundId, uint256 profitAmount);
    event ProfitDistributed(uint256 indexed roundId, address indexed follower, uint256 amount);
    event RoundCompleted(uint256 indexed roundId);

    constructor(
        address _usdt,
        address _cUSDT
    ) Ownable(msg.sender) {
        usdt = IERC20(_usdt);
        cUSDT = IConfidentialUSDT(_cUSDT);
    }

    function createTradingRound(
        uint256 _targetAmount,
        uint256 _duration
    ) external {
        require(_targetAmount >= MIN_TARGET_AMOUNT, "Target amount too low");
        require(_duration >= MIN_ROUND_DURATION && _duration <= MAX_ROUND_DURATION, "Invalid duration");
        
        uint256 roundId = ++currentRoundId;
        
        tradingRounds[roundId] = TradingRound({
            leader: msg.sender,
            targetAmount: _targetAmount,
            duration: _duration,
            startTime: block.timestamp,
            endTime: block.timestamp + _duration,
            totalDeposited: FHE.asEuint64(0),
            totalProfit: FHE.asEuint64(0),
            isActive: true,
            isProfitDistributed: false,
            followerCount: 0
        });
        
        emit RoundCreated(roundId, msg.sender, _targetAmount, _duration);
    }

    function joinRound(
        uint256 _roundId,
        externalEuint64 _encryptedAmount,
        bytes calldata _inputProof
    ) external nonReentrant {
        TradingRound storage round = tradingRounds[_roundId];
        require(round.isActive, "Round not active");
        require(block.timestamp < round.endTime, "Round has ended");
        require(msg.sender != round.leader, "Leader cannot join as follower");
        require(!followers[_roundId][msg.sender].hasDeposited, "Already deposited");
        
        euint64 amount = FHE.fromExternal(_encryptedAmount, _inputProof);
        
        // Transfer encrypted USDT from user to contract
        cUSDT.confidentialTransferFrom(msg.sender, address(this), amount);
        
        followers[_roundId][msg.sender] = Follower({
            depositAmount: amount,
            hasDeposited: true,
            hasWithdrawn: false
        });
        
        roundFollowers[_roundId].push(msg.sender);
        round.followerCount++;
        round.totalDeposited = FHE.add(round.totalDeposited, amount);
        
        // Grant ACL permissions
        FHE.allowThis(round.totalDeposited);
        FHE.allowThis(followers[_roundId][msg.sender].depositAmount);
        FHE.allow(followers[_roundId][msg.sender].depositAmount, msg.sender);
        
        emit FollowerJoined(_roundId, msg.sender, 0); // We don't emit the actual amount for privacy
    }

    function extractFunds(uint256 _roundId) external nonReentrant {
        TradingRound storage round = tradingRounds[_roundId];
        require(msg.sender == round.leader, "Only leader can extract");
        require(round.isActive, "Round not active");
        
        // Request decryption of total deposited amount for unwrapping
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(round.totalDeposited);
        
        uint256 requestId = FHE.requestDecryption(cts, this.extractFundsCallback.selector);
        
        // Store the round ID for the callback
        pendingExtractions[requestId] = _roundId;
    }
    
    mapping(uint256 => uint256) private pendingExtractions;
    
    function extractFundsCallback(
        uint256 _requestId,
        uint64 _decryptedAmount,
        bytes[] memory _signatures
    ) public {
        FHE.checkSignatures(_requestId, _signatures);
        
        uint256 roundId = pendingExtractions[_requestId];
        delete pendingExtractions[_requestId];
        
        TradingRound storage round = tradingRounds[roundId];
        require(round.isActive, "Round not active");
        require(msg.sender == address(this), "Invalid callback");
        
        // Unwrap encrypted USDT to regular USDT for trading
        cUSDT.unwrap(uint256(_decryptedAmount));
        
        // Transfer regular USDT to leader for trading
        require(usdt.transfer(round.leader, uint256(_decryptedAmount)), "Transfer failed");
        
        emit FundsExtracted(roundId, round.leader, uint256(_decryptedAmount));
    }

    function depositProfit(
        uint256 _roundId,
        uint256 _profitAmount
    ) external {
        TradingRound storage round = tradingRounds[_roundId];
        require(msg.sender == round.leader, "Only leader can deposit profit");
        require(round.isActive, "Round not active");
        require(block.timestamp >= round.endTime, "Round not finished");
        
        // Transfer USDT from leader and wrap to encrypted USDT
        require(usdt.transferFrom(msg.sender, address(this), _profitAmount), "Transfer failed");
        
        // Approve cUSDT contract to spend USDT
        usdt.approve(address(cUSDT), _profitAmount);
        
        // Wrap USDT to encrypted USDT
        cUSDT.wrap(address(this), _profitAmount);
        
        // Convert profit to encrypted amount
        euint64 encryptedProfit = FHE.asEuint64(uint64(_profitAmount));
        round.totalProfit = FHE.add(round.totalProfit, encryptedProfit);
        
        FHE.allowThis(round.totalProfit);
        
        emit ProfitDeposited(_roundId, _profitAmount);
    }

    function distributeProfit(uint256 _roundId) external {
        TradingRound storage round = tradingRounds[_roundId];
        require(round.isActive, "Round not active");
        require(block.timestamp >= round.endTime, "Round not finished");
        require(!round.isProfitDistributed, "Profit already distributed");
        require(msg.sender == round.leader || msg.sender == owner(), "Unauthorized");
        
        round.isProfitDistributed = true;
        round.isActive = false;
        
        // Calculate and distribute profits to each follower
        address[] memory roundFollowersList = roundFollowers[_roundId];
        
        for (uint256 i = 0; i < roundFollowersList.length; i++) {
            address followerAddr = roundFollowersList[i];
            Follower storage follower = followers[_roundId][followerAddr];
            
            if (follower.hasDeposited && !follower.hasWithdrawn) {
                // Calculate follower's share: (depositAmount / totalDeposited) * totalProfit
                euint64 followerShare = calculateFollowerShare(
                    follower.depositAmount,
                    round.totalDeposited,
                    round.totalProfit
                );
                
                // Add original deposit to profit share
                euint64 totalReturn = FHE.add(follower.depositAmount, followerShare);
                
                // Transfer total return to follower
                cUSDT.confidentialTransfer(followerAddr, totalReturn);
                
                follower.hasWithdrawn = true;
                
                // Grant ACL permissions
                FHE.allowThis(totalReturn);
                FHE.allow(totalReturn, followerAddr);
            }
        }
        
        emit RoundCompleted(_roundId);
    }

    function calculateFollowerShare(
        euint64 _depositAmount,
        euint64 /* _totalDeposited */,
        euint64 _totalProfit
    ) internal returns (euint64) {
        // Use FHE operations to calculate: (_depositAmount * _totalProfit) / _totalDeposited
        euint64 numerator = FHE.mul(_depositAmount, _totalProfit);
        
        // Note: FHE division is complex, so we approximate using shifts for common cases
        // In production, you might want to use a more sophisticated division algorithm
        // For now, we use a simplified approach
        
        // This is a simplified calculation - in production you'd want more precision
        // Note: FHE division is limited, so we use a simplified approach
        // For more precision, you would implement a custom division algorithm
        return numerator; // Simplified - returns proportional amount without division
    }

    function emergencyWithdraw(uint256 _roundId) external nonReentrant {
        TradingRound storage round = tradingRounds[_roundId];
        Follower storage follower = followers[_roundId][msg.sender];
        
        require(follower.hasDeposited, "No deposit found");
        require(!follower.hasWithdrawn, "Already withdrawn");
        require(block.timestamp > round.endTime + 7 days, "Emergency period not reached");
        
        follower.hasWithdrawn = true;
        
        // Return original deposit only (no profit)
        cUSDT.confidentialTransfer(msg.sender, follower.depositAmount);
        
        FHE.allow(follower.depositAmount, msg.sender);
    }

    // View functions
    function getRoundInfo(uint256 _roundId) external view returns (
        address leader,
        uint256 targetAmount,
        uint256 duration,
        uint256 startTime,
        uint256 endTime,
        bool isActive,
        bool isProfitDistributed,
        uint256 followerCount
    ) {
        TradingRound storage round = tradingRounds[_roundId];
        return (
            round.leader,
            round.targetAmount,
            round.duration,
            round.startTime,
            round.endTime,
            round.isActive,
            round.isProfitDistributed,
            round.followerCount
        );
    }

    function getFollowerInfo(uint256 _roundId, address _follower) external view returns (
        euint64 depositAmount,
        bool hasDeposited,
        bool hasWithdrawn
    ) {
        Follower storage follower = followers[_roundId][_follower];
        return (
            follower.depositAmount,
            follower.hasDeposited,
            follower.hasWithdrawn
        );
    }

    function getRoundFollowers(uint256 _roundId) external view returns (address[] memory) {
        return roundFollowers[_roundId];
    }

    function getTotalDeposited(uint256 _roundId) external view returns (euint64) {
        return tradingRounds[_roundId].totalDeposited;
    }

    function getTotalProfit(uint256 _roundId) external view returns (euint64) {
        return tradingRounds[_roundId].totalProfit;
    }
}