// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ConfidentialFungibleToken} from "@openzeppelin/confidential-contracts/token/ConfidentialFungibleToken.sol";
import "hardhat/console.sol";

contract LeadTrading is SepoliaConfig, ReentrancyGuard, Ownable {
    struct TradingRound {
        address leader;
        uint256 targetAmount;
        uint256 duration;
        uint256 startTime;
        uint256 endTime;
        euint64 totalDeposited; // Encrypted version
        euint64 totalProfit; // Encrypted version
        uint256 decryptedTotalDeposited; // Decrypted version
        uint256 decryptedTotalProfit; // Decrypted version
        bool isActive;
        bool isProfitDistributed;
        bool depositsEnabled;
        uint256 followerCount;
        uint256 unitProfitRate; // Profit rate per unit deposit (scaled by 1e18)
    }

    struct Follower {
        euint64 depositAmount;
        bool hasDeposited;
        bool hasWithdrawn;
    }

    ConfidentialFungibleToken public immutable cUSDT;

    uint256 public currentRoundId;
    uint256 public constant MIN_ROUND_DURATION = 1 days;
    uint256 public constant MAX_ROUND_DURATION = 365 days;
    uint256 public constant MIN_TARGET_AMOUNT = 1000 * 10 ** 6; // 1000 USDT

    mapping(uint256 => TradingRound) public tradingRounds;
    mapping(uint256 => mapping(address => Follower)) public followers;
    mapping(uint256 => address[]) public roundFollowers;
    mapping(address => uint256[]) public leaderRounds; // Track all rounds by leader

    event RoundCreated(uint256 indexed roundId, address indexed leader, uint256 targetAmount, uint256 duration);
    event FollowerJoined(uint256 indexed roundId, address indexed follower, uint256 encryptedAmount);
    event ProfitDeposited(uint256 indexed roundId);
    event ProfitDistributed(uint256 indexed roundId, address indexed follower, uint256 amount);
    event RoundCompleted(uint256 indexed roundId);
    event DepositsDisabled(uint256 indexed roundId);
    event ProfitWithdrawn(uint256 indexed roundId, address indexed follower, uint256 amount);

    constructor(address _cUSDT) Ownable(msg.sender) {
        cUSDT = ConfidentialFungibleToken(_cUSDT);
    }

    function createTradingRound(uint256 _targetAmount, uint256 _duration) external {
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
            decryptedTotalDeposited: 0,
            decryptedTotalProfit: 0,
            isActive: true,
            isProfitDistributed: false,
            depositsEnabled: true,
            followerCount: 0,
            unitProfitRate: 0
        });

        // Add round to leader's list
        leaderRounds[msg.sender].push(roundId);

        FHE.allowThis(tradingRounds[roundId].totalDeposited);
        FHE.allowThis(tradingRounds[roundId].totalProfit);

        emit RoundCreated(roundId, msg.sender, _targetAmount, _duration);
    }

    function joinRound(
        uint256 _roundId,
        externalEuint64 _encryptedAmount,
        bytes calldata _inputProof
    ) external nonReentrant {
        TradingRound storage round = tradingRounds[_roundId];
        require(round.isActive, "Round not active");
        require(round.depositsEnabled, "Deposits disabled by leader");
        require(block.timestamp < round.endTime, "Round has ended");
        require(msg.sender != round.leader, "Leader cannot join as follower");
        require(!followers[_roundId][msg.sender].hasDeposited, "Already deposited");
        console.log("joinRound 1");
        euint64 amount = FHE.fromExternal(_encryptedAmount, _inputProof);
        console.log("joinRound 2");
        // Transfer encrypted USDT from user to contract
        // cUSDT.setOperator(operator, until);
        FHE.allowTransient(amount, address(cUSDT));
        console.log("joinRound 3");
        cUSDT.confidentialTransferFrom(msg.sender, address(this), amount);
        console.log("joinRound 4");

        followers[_roundId][msg.sender] = Follower({depositAmount: amount, hasDeposited: true, hasWithdrawn: false});

        roundFollowers[_roundId].push(msg.sender);
        round.followerCount++;
        round.totalDeposited = FHE.add(round.totalDeposited, amount);
        console.log("joinRound 5");
        // Grant ACL permissions
        FHE.allowThis(round.totalDeposited);
        FHE.allowThis(followers[_roundId][msg.sender].depositAmount);
        FHE.allow(followers[_roundId][msg.sender].depositAmount, msg.sender);
        console.log("joinRound 6");
        emit FollowerJoined(_roundId, msg.sender, 0); // We don't emit the actual amount for privacy
    }

    function stopDeposits(uint256 _roundId) external {
        TradingRound storage round = tradingRounds[_roundId];
        require(msg.sender == round.leader, "Only leader can stop deposits");
        require(round.isActive, "Round not active");
        require(round.depositsEnabled, "Deposits already disabled");

        round.depositsEnabled = false;
        emit DepositsDisabled(_roundId);
    }

    function extractFunds(uint256 _roundId) external nonReentrant {
        TradingRound storage round = tradingRounds[_roundId];
        require(msg.sender == round.leader, "Only leader can extract");
        require(!round.depositsEnabled, "Deposits not disabled");
        require(round.isActive, "Round not active");

        // Transfer all deposited cUSDT to leader for trading
        FHE.allowTransient(round.totalDeposited, address(cUSDT));
        cUSDT.confidentialTransfer(round.leader, round.totalDeposited);

        // Grant ACL permissions
        FHE.allow(round.totalDeposited, round.leader);
    }

    function depositProfit(
        uint256 _roundId,
        externalEuint64 _encryptedProfitAmount,
        bytes calldata _inputProof
    ) external {
        TradingRound storage round = tradingRounds[_roundId];
        require(msg.sender == round.leader, "Only leader can deposit profit");
        require(round.isActive, "Round not active");
        require(!round.depositsEnabled, "Deposits still enabled");

        euint64 profitAmount = FHE.fromExternal(_encryptedProfitAmount, _inputProof);

        // Transfer encrypted profit from leader to contract
        FHE.allowTransient(profitAmount, address(cUSDT));
        cUSDT.confidentialTransferFrom(msg.sender, address(this), profitAmount);

        // Add to total profit
        round.totalProfit = FHE.add(round.totalProfit, profitAmount);

        FHE.allowThis(round.totalProfit);

        emit ProfitDeposited(_roundId);
    }

    mapping(uint256 => uint256) private pendingProfitCalculations;

    function distributeProfit(uint256 _roundId) external {
        TradingRound storage round = tradingRounds[_roundId];
        require(round.isActive, "Round not active");
        require(!round.depositsEnabled, "Deposits still enabled");
        require(!round.isProfitDistributed, "Profit already distributed");
        require(msg.sender == round.leader || msg.sender == owner(), "Unauthorized");

        // Request decryption of both total deposited and total profit
        bytes32[] memory cts = new bytes32[](2);
        cts[0] = FHE.toBytes32(round.totalDeposited);
        cts[1] = FHE.toBytes32(round.totalProfit);

        uint256 requestId = FHE.requestDecryption(cts, this.distributeProfitCallback.selector);
        pendingProfitCalculations[requestId] = _roundId;
    }

    function distributeProfitCallback(
        uint256 _requestId,
        uint64 _decryptedTotalDeposited,
        uint64 _decryptedTotalProfit,
        bytes[] memory _signatures
    ) public {
        FHE.checkSignatures(_requestId, _signatures);

        uint256 roundId = pendingProfitCalculations[_requestId];
        delete pendingProfitCalculations[_requestId];

        TradingRound storage round = tradingRounds[roundId];
        require(round.isActive, "Round not active");
        require(msg.sender == address(this), "Invalid callback");

        // Store decrypted values
        round.decryptedTotalDeposited = uint256(_decryptedTotalDeposited);
        round.decryptedTotalProfit = uint256(_decryptedTotalProfit);

        // Calculate unit profit rate: (totalProfit * 1e18) / totalDeposited
        if (_decryptedTotalDeposited > 0) {
            round.unitProfitRate = (uint256(_decryptedTotalProfit) * 1e18) / uint256(_decryptedTotalDeposited);
        } else {
            round.unitProfitRate = 0;
        }

        round.isProfitDistributed = true;
        round.isActive = false;

        emit RoundCompleted(roundId);
    }

    function withdrawProfit(uint256 _roundId) external nonReentrant {
        TradingRound storage round = tradingRounds[_roundId];
        Follower storage follower = followers[_roundId][msg.sender];

        require(follower.hasDeposited, "No deposit found");
        require(!follower.hasWithdrawn, "Already withdrawn");
        require(round.isProfitDistributed, "Profit not yet calculated");
        require(round.unitProfitRate > 0 || block.timestamp > round.endTime + 7 days, "No profit available");

        follower.hasWithdrawn = true;

        // Request decryption of follower's deposit amount to calculate profit
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(follower.depositAmount);

        uint256 requestId = FHE.requestDecryption(cts, this.withdrawProfitCallback.selector);
        pendingWithdrawals[requestId] = WithdrawalRequest({roundId: _roundId, follower: msg.sender});
    }

    struct WithdrawalRequest {
        uint256 roundId;
        address follower;
    }

    mapping(uint256 => WithdrawalRequest) private pendingWithdrawals;

    function withdrawProfitCallback(
        uint256 _requestId,
        uint64 _decryptedDepositAmount,
        bytes[] memory _signatures
    ) public {
        FHE.checkSignatures(_requestId, _signatures);

        WithdrawalRequest memory request = pendingWithdrawals[_requestId];
        delete pendingWithdrawals[_requestId];

        TradingRound storage round = tradingRounds[request.roundId];
        require(msg.sender == address(this), "Invalid callback");

        // Calculate total return: deposit + (deposit * unitProfitRate / 1e18)
        uint256 depositAmount = uint256(_decryptedDepositAmount);
        uint256 profitAmount = (depositAmount * round.unitProfitRate) / 1e18;
        uint256 totalReturn = depositAmount + profitAmount;

        // Convert back to encrypted amount and transfer
        euint64 encryptedTotalReturn = FHE.asEuint64(uint64(totalReturn));
        cUSDT.confidentialTransfer(request.follower, encryptedTotalReturn);

        // Grant ACL permissions
        FHE.allow(encryptedTotalReturn, request.follower);

        emit ProfitWithdrawn(request.roundId, request.follower, totalReturn);
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
    function getRoundInfo(
        uint256 _roundId
    )
        external
        view
        returns (
            address leader,
            uint256 targetAmount,
            uint256 duration,
            uint256 startTime,
            uint256 endTime,
            bool isActive,
            bool isProfitDistributed,
            bool depositsEnabled,
            uint256 followerCount,
            uint256 unitProfitRate,
            uint256 decryptedTotalDeposited,
            uint256 decryptedTotalProfit
        )
    {
        TradingRound storage round = tradingRounds[_roundId];
        return (
            round.leader,
            round.targetAmount,
            round.duration,
            round.startTime,
            round.endTime,
            round.isActive,
            round.isProfitDistributed,
            round.depositsEnabled,
            round.followerCount,
            round.unitProfitRate,
            round.decryptedTotalDeposited,
            round.decryptedTotalProfit
        );
    }

    function getFollowerInfo(
        uint256 _roundId,
        address _follower
    ) external view returns (euint64 depositAmount, bool hasDeposited, bool hasWithdrawn) {
        Follower storage follower = followers[_roundId][_follower];
        return (follower.depositAmount, follower.hasDeposited, follower.hasWithdrawn);
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

    function getLeaderRounds(address _leader) external view returns (uint256[] memory) {
        return leaderRounds[_leader];
    }

    function getLeaderRoundsCount(address _leader) external view returns (uint256) {
        return leaderRounds[_leader].length;
    }

    function getDecryptedAmounts(
        uint256 _roundId
    ) external view returns (uint256 decryptedTotalDeposited, uint256 decryptedTotalProfit) {
        TradingRound storage round = tradingRounds[_roundId];
        return (round.decryptedTotalDeposited, round.decryptedTotalProfit);
    }
}
