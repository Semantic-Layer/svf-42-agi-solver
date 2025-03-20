// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "solmate/tokens/ERC20.sol";

contract TokenA is ERC20 {
    constructor() ERC20("SVF42", "SVF42", 18) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
} 