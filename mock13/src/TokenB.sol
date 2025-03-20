// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "solmate/tokens/ERC20.sol";

contract TokenB is ERC20 {
    constructor() ERC20("TokenB", "TKNB", 18) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
} 