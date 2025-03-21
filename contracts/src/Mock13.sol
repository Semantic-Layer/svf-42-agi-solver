// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "solmate/tokens/ERC20.sol";
import "solmate/utils/SafeTransferLib.sol";
import {Owned} from "solmate/auth/Owned.sol";

contract Mock13 is Owned {
    /// @notice the address of the AI that publishes the AGI
    address public immutable ai;

    /// @notice the next order index. it starts from 1
    /// @dev it is used to generate the order index for the new AGI
    uint256 public nextOrderIndex = 1;

    /// @notice the address of the solver
    /// @dev only the owner can set the address of the solver
    mapping(address solver => bool isSolver) public isSolver;

    /// @notice the order index to the AGI
    mapping(uint256 orderIndex => AgentGeneratedIntent intent) public agis;

    // Enum to represent order status
    enum OrderStatus {
        // pending to dispense asset to sell
        PendingDispense,
        // asset to sell is dispensed but pending deposit of proceeds
        DispensedPendingProceeds,
        // proceeds received
        ProceedsReceived
    }

    struct AgentGeneratedIntent {
        uint8 intentType; // 0 for trade, 1 for others
        address assetToSell; // address of asset to sell (SVF42 or whitelisted)
        uint256 amountToSell; // amount of asset to sell
        address assetToBuy; // address of asset to buy (SVF42 or whitelisted)
        uint256 orderIndex; // index in array
        OrderStatus orderStatus; // 0: pending dispense, 1: dispensed pending deposit, 2: completed
    }

    event AGIPublished(
        uint256 orderIndex, uint8 intentType, address assetToSell, uint256 amountToSell, address assetToBuy
    );

    modifier onlyAI() {
        require(msg.sender == ai, "Only AI can call");
        _;
    }

    modifier onlySolver() {
        require(isSolver[msg.sender], "Only solver can call");
        _;
    }

    constructor(address owner_, address ai_) Owned(owner_) {
        ai = ai_;

        // just for testing. set the owner as a solver
        isSolver[owner_] = true;
    }

    /// @notice set the address of the solver
    function setAGISolverAddress(address newSolver_, bool isSolver_) external onlyOwner {
        isSolver[newSolver_] = isSolver_;
    }

    /// @notice publish a new AGI
    function publishAGI(uint8 intentType, address assetToSell, uint256 amountToSell, address assetToBuy)
        external
        onlyAI
    {
        require(intentType == 0, "Only trade intents supported");
        require(assetToSell == address(0) || assetToBuy == address(0), "Invalid asset to sell or buy");
        require(assetToSell != assetToBuy, "Asset to sell and buy cannot be the same");

        uint256 orderIndex = nextOrderIndex++;

        AgentGeneratedIntent memory newIntent = AgentGeneratedIntent({
            intentType: intentType,
            assetToSell: assetToSell,
            amountToSell: amountToSell,
            assetToBuy: assetToBuy,
            orderIndex: orderIndex,
            orderStatus: OrderStatus.PendingDispense
        });

        agis[orderIndex] = newIntent;
        emit AGIPublished(orderIndex, intentType, assetToSell, amountToSell, assetToBuy);
    }

    function viewAGI(uint256 orderIndex) external view returns (AgentGeneratedIntent memory) {
        return agis[orderIndex];
    }

    function withdrawAsset(uint256 orderIndex) external onlySolver {
        AgentGeneratedIntent storage intent = agis[orderIndex];
        require(intent.intentType == 0, "Invalid intent type");
        require(intent.orderStatus == OrderStatus.PendingDispense, "Invalid order status");
        intent.orderStatus = OrderStatus.DispensedPendingProceeds;

        _checkBalance(intent.assetToSell, intent.amountToSell);

        SafeTransferLib.safeTransfer(ERC20(intent.assetToSell), msg.sender, intent.amountToSell);
    }

    function depositAsset(uint256 orderIndex, uint256 amount) external onlySolver {
        AgentGeneratedIntent storage intent = agis[orderIndex];
        require(intent.intentType == 0, "Invalid intent type");
        require(intent.orderStatus == OrderStatus.DispensedPendingProceeds, "Invalid order status");
        intent.orderStatus = OrderStatus.ProceedsReceived;
        SafeTransferLib.safeTransferFrom(ERC20(intent.assetToBuy), msg.sender, address(this), amount);
    }

    function _checkBalance(address asset, uint256 amount) internal view {
        if (asset == address(0)) {
            require(address(this).balance >= amount, "Insufficient balance");
        } else {
            require(ERC20(asset).balanceOf(address(this)) >= amount, "Insufficient balance");
        }
    }
}
