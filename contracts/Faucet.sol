// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {cUSDT} from "./cUSDT.sol";

contract Faucet is SepoliaConfig {
    IERC20 public immutable USDT; // Still need USDT for minting cUSDT
    cUSDT public immutable C_USDT_TOKEN;

    // Amount to distribute per claim (1000 cUSDT with 6 decimals)
    uint256 public constant CLAIM_AMOUNT = 1000 * 10 ** 6;

    // Cooldown period between claims (24 hours)
    uint256 public constant COOLDOWN_PERIOD = 24 hours;

    // Mapping to track last claim time for each user
    mapping(address => uint256) public lastClaimTime;

    event TokensClaimed(address indexed user, uint256 amount);
    event TokensDeposited(uint256 amount);

    constructor(IERC20 _usdt, cUSDT _cUsdtToken) {
        USDT = _usdt;
        C_USDT_TOKEN = _cUsdtToken;
    }

    /**
     * @notice Claim 1000 cUSDT tokens (once per 24 hours per address)
     */
    function claimTokens() external {
        require(block.timestamp >= lastClaimTime[msg.sender] + COOLDOWN_PERIOD, "Cooldown period not elapsed");

        require(USDT.balanceOf(address(this)) >= CLAIM_AMOUNT, "Insufficient USDT balance for wrapping");

        // Update last claim time
        lastClaimTime[msg.sender] = block.timestamp;

        // Approve cUSDT contract to spend USDT
        USDT.approve(address(C_USDT_TOKEN), CLAIM_AMOUNT);

        // Wrap USDT to cUSDT and transfer to user
        C_USDT_TOKEN.wrap(msg.sender, CLAIM_AMOUNT);

        emit TokensClaimed(msg.sender, CLAIM_AMOUNT);
    }

    /**
     * @notice Wrap USDT to cUSDT for the user
     * @param amount Amount of USDT to wrap (with 6 decimals)
     */
    function wrapToConfidential(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");

        // Transfer USDT from user to this contract
        require(USDT.transferFrom(msg.sender, address(this), amount), "USDT transfer failed");

        // Approve cUSDT contract to spend USDT
        USDT.approve(address(C_USDT_TOKEN), amount);

        // Wrap USDT to cUSDT (automatically transfers to user)
        C_USDT_TOKEN.wrap(msg.sender, amount);
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
        return USDT.balanceOf(address(this));
    }

    /**
     * @notice Deposit USDT to faucet (for refilling)
     * @param amount Amount to deposit
     */
    function depositToFaucet(uint256 amount) external {
        require(USDT.transferFrom(msg.sender, address(this), amount), "USDT transfer failed");

        emit TokensDeposited(amount);
    }
}
