// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Owned} from "solmate/auth/Owned.sol";

contract MockVesting is Owned {
    uint256 public totalVestedAmount;

    constructor(address owner_) Owned(owner_) {
        // Set a default total vested amount for testing (e.g., 500,000 tokens with 18 decimals)
        totalVestedAmount = 500_000 * 10 ** 18;
    }

    function totalVested() external view returns (uint256) {
        return totalVestedAmount;
    }

    function setTotalVested(uint256 _amount) external onlyOwner {
        totalVestedAmount = _amount;
    }
}
