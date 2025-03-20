// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "solmate/tokens/ERC20.sol";
import "solmate/utils/SafeTransferLib.sol";

contract Mock13 {
    address public constant ADMIN = 0x6C00Cbc79FED15c26716bDE40d29F4058Be63fDA;
    address public AGISolverAddress = ADMIN;

    struct AgentGeneratedIntent {
        uint8 intentType;      // 0 for trade, 1 for others
        address assetToSell;   // address of asset to sell (SVF42 or whitelisted)
        uint256 amountToSell;  // amount of asset to sell
        address assetToBuy;    // address of asset to buy (SVF42 or whitelisted)
        uint256 orderIndex;    // index in array
        uint8 orderStatus;     // 0: pending dispense, 1: dispensed pending deposit, 2: completed
    }

    AgentGeneratedIntent[] public AgentGeneratedIntentList;

    event AGIPublished(uint256 orderIndex);

    modifier onlyAdmin() {
        require(msg.sender == ADMIN, "Only admin can call");
        _;
    }

    modifier onlyAI() {
        require(msg.sender == ADMIN, "Only AI can call");
        _;
    }

    modifier onlySolver() {
        require(msg.sender == AGISolverAddress, "Only solver can call");
        _;
    }

    function publishAGI(
        uint8 intentType,
        address assetToSell,
        uint256 amountToSell,
        address assetToBuy
    ) external onlyAI {
        require(intentType == 0, "Only trade intents supported");
        
        uint256 orderIndex = AgentGeneratedIntentList.length;
        
        AgentGeneratedIntent memory newIntent = AgentGeneratedIntent({
            intentType: intentType,
            assetToSell: assetToSell,
            amountToSell: amountToSell,
            assetToBuy: assetToBuy,
            orderIndex: orderIndex,
            orderStatus: 0
        });

        AgentGeneratedIntentList.push(newIntent);
        emit AGIPublished(orderIndex);
    }

    function viewAGI(uint256 orderIndex) external view returns (AgentGeneratedIntent memory) {
        require(orderIndex < AgentGeneratedIntentList.length, "Invalid order index");
        return AgentGeneratedIntentList[orderIndex];
    }

    function withdrawSVF(uint256 amount, uint256 orderIndex) external onlySolver {
        AgentGeneratedIntent storage intent = AgentGeneratedIntentList[orderIndex];
        require(intent.orderStatus == 0, "Invalid order status");
        require(intent.amountToSell == amount, "Amount mismatch");
        
        intent.orderStatus = 1;
        SafeTransferLib.safeTransfer(ERC20(intent.assetToSell), msg.sender, amount);
    }

    function withdrawAsset(uint256 amount, uint256 orderIndex) external onlySolver {
        AgentGeneratedIntent storage intent = AgentGeneratedIntentList[orderIndex];
        require(intent.orderStatus == 0, "Invalid order status");
        require(intent.amountToSell == amount, "Amount mismatch");
        
        intent.orderStatus = 1;
        SafeTransferLib.safeTransfer(ERC20(intent.assetToSell), msg.sender, amount);
    }

    function depositSVF(uint256 amount, uint256 orderIndex) external onlySolver {
        AgentGeneratedIntent storage intent = AgentGeneratedIntentList[orderIndex];
        require(intent.orderStatus == 1, "Invalid order status");
        require(intent.intentType == 0, "Invalid intent type");
        
        intent.orderStatus = 2;
        SafeTransferLib.safeTransferFrom(ERC20(intent.assetToBuy), msg.sender, address(this), amount);
    }

    function depositAsset(uint256 amount, uint256 orderIndex) external onlySolver {
        AgentGeneratedIntent storage intent = AgentGeneratedIntentList[orderIndex];
        require(intent.orderStatus == 1, "Invalid order status");
        require(intent.intentType == 0, "Invalid intent type");
        
        intent.orderStatus = 2;
        SafeTransferLib.safeTransferFrom(ERC20(intent.assetToBuy), msg.sender, address(this), amount);
    }

    function updateAGISolverAddress(address newSolver) external onlyAdmin {
        require(newSolver != address(0), "Invalid address");
        AGISolverAddress = newSolver;
    }
} 