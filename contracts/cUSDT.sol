// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {
    ConfidentialFungibleTokenERC20Wrapper
} from "@openzeppelin/confidential-contracts/token/extensions/ConfidentialFungibleTokenERC20Wrapper.sol";
import {ConfidentialFungibleToken} from "@openzeppelin/confidential-contracts/token/ConfidentialFungibleToken.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract cUSDT is ConfidentialFungibleTokenERC20Wrapper, SepoliaConfig {
    constructor(
        IERC20 usdt
    ) ConfidentialFungibleTokenERC20Wrapper(usdt) ConfidentialFungibleToken("cUSDT", "cUSDT", "") {}
}
