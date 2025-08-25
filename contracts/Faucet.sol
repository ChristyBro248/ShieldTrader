// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {cUSDT} from "./cUSDT.sol";

contract Faucet is SepoliaConfig {
    IERC20 public immutable usdt;
    cUSDT public immutable cUsdtToken;
    
    // Amount to distribute per claim (1000 USDT with 6 decimals)
    uint256 public constant CLAIM_AMOUNT = 1000 * 10**6;
    
    // Cooldown period between claims (24 hours)
    uint256 public constant COOLDOWN_PERIOD = 24 hours;
    
    // Mapping to track last claim time for each user
    mapping(address => uint256) public lastClaimTime;
    
    event TokensClaimed(address indexed user, uint256 amount);
    event TokensDeposited(uint256 amount);
    
    constructor(IERC20 _usdt, cUSDT _cUsdtToken) {
        usdt = _usdt;
        cUsdtToken = _cUsdtToken;
    }
    
    /**
     * @notice Claim 1000 cUSDT tokens (once per 24 hours per address)
     */
    function claimTokens() external {
        require(
            block.timestamp >= lastClaimTime[msg.sender] + COOLDOWN_PERIOD,
            "Cooldown period not elapsed"
        );
        
        require(
            usdt.balanceOf(address(this)) >= CLAIM_AMOUNT,
            "Insufficient faucet balance"
        );
        
        // Update last claim time
        lastClaimTime[msg.sender] = block.timestamp;
        
        // Transfer USDT to user
        require(
            usdt.transfer(msg.sender, CLAIM_AMOUNT),
            "USDT transfer failed"
        );
        
        emit TokensClaimed(msg.sender, CLAIM_AMOUNT);
    }
    
    /**
     * @notice Wrap USDT to cUSDT for the user
     * @param amount Amount of USDT to wrap (with 6 decimals)
     */
    function wrapToConfidential(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        
        // Transfer USDT from user to this contract
        require(
            usdt.transferFrom(msg.sender, address(this), amount),
            "USDT transfer failed"
        );
        
        // Approve cUSDT contract to spend USDT
        usdt.approve(address(cUsdtToken), amount);
        
        // Wrap USDT to cUSDT
        cUsdtToken.wrap(amount);
        
        // Transfer wrapped cUSDT to user
        cUsdtToken.transfer(msg.sender, amount);
    }
    
    /**
     * @notice Check if user can claim tokens
     * @param user Address to check
     * @return canClaim Whether user can claim
     * @return timeRemaining Seconds remaining until next claim (0 if can claim)
     */
    function canClaimTokens(address user) external view returns (bool canClaim, uint256 timeRemaining) {
        uint256 nextClaimTime = lastClaimTime[user] + COOLDOWN_PERIOD;
        if (block.timestamp >= nextClaimTime) {
            return (true, 0);
        } else {
            return (false, nextClaimTime - block.timestamp);
        }
    }
    
    /**
     * @notice Get faucet balance
     */
    function getFaucetBalance() external view returns (uint256) {
        return usdt.balanceOf(address(this));
    }
    
    /**
     * @notice Deposit USDT to faucet (for refilling)
     * @param amount Amount to deposit
     */
    function depositToFaucet(uint256 amount) external {
        require(
            usdt.transferFrom(msg.sender, address(this), amount),
            "USDT transfer failed"
        );
        
        emit TokensDeposited(amount);
    }
    
    /**
     * @notice Emergency withdraw (only for contract owner functionality if needed)
     * For now, anyone can refill the faucet by calling depositToFaucet
     */
    function emergencyWithdraw() external {
        require(msg.sender == 0x742d35Cc481CF8a10bC5312F1E4e8A0e8f3B2e22, "Not authorized");
        uint256 balance = usdt.balanceOf(address(this));
        require(usdt.transfer(msg.sender, balance), "Transfer failed");
    }
}