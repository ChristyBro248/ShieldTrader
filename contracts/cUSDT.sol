// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {
    ConfidentialFungibleTokenERC20Wrapper
} from "@openzeppelin/confidential-contracts/token/extensions/ConfidentialFungibleTokenERC20Wrapper.sol";
import {ConfidentialFungibleToken} from "@openzeppelin/confidential-contracts/token/ConfidentialFungibleToken.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {FHE, externalEuint64, euint64} from "@fhevm/solidity/lib/FHE.sol";

contract cUSDT is ConfidentialFungibleToken, SepoliaConfig {
    constructor() ConfidentialFungibleToken("cUSDT", "cUSDT", "") {}

    // _mint(address to, euint64 amount)
    function faucet() external {
        _mint(msg.sender, FHE.asEuint64(1000 * 10 ** 6));
    }
}
