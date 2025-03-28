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
    uint256 public nextOrderId = 1;

    /// @notice the address of the solver
    /// @dev only the owner can set the address of the solver
    mapping(address solver => bool isSolver) public isSolver;

    /// @notice the order index to the AGI
    mapping(uint256 orderIndex => AgentGeneratedIntent intent) public agis;

    /// @notice tracking processed AGIs
    uint256[] public processedAGIs;

    // Enum to represent order status
    enum OrderStatus {
        // pending to dispense asset to sell
        PendingDispense,
        // asset to sell is dispensed but pending deposit of proceeds
        DispensedPendingProceeds,
        // proceeds received
        ProceedsReceived
    }

    // Structs
    struct AgentGeneratedIntent {
        uint8 orderType; // 0: trade, 1: others
        uint256 orderId; // the id for the order. it's incremental and auto generated
        address assetToSell; // address of the asset to sell, could be $SVF42 or whitelisted asset
        uint256 amountToSell; // amount of the asset to sell (inputAmount)
        address assetToBuy; // address of the asset to buy, could be $SVF42 or whitelisted asset
        OrderStatus orderStatus; // Status of the order
    }

    event AGIPublished(
        uint256 indexed orderId,
        address assetToSell,
        uint256 amountToSell,
        address assetToBuy,
        uint8 orderType,
        OrderStatus orderStatus
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
        isSolver[ai_] = true;
    }

    /// @notice set the address of the solver
    function setAGISolverAddress(address newSolver_, bool isSolver_) external onlyOwner {
        isSolver[newSolver_] = isSolver_;
    }

    /// @notice publish a new AGI
    function publishAGI(address assetToSell, uint256 amountToSell, address assetToBuy)
        external
        onlyAI
    {
        require(assetToSell != address(0) || assetToBuy != address(0), "Invalid asset to sell or buy");
        require(assetToSell != assetToBuy, "Asset to sell and buy cannot be the same");

        uint256 orderId = nextOrderId++;

        AgentGeneratedIntent memory newIntent = AgentGeneratedIntent({
            orderType: 0,
            assetToSell: assetToSell,
            amountToSell: amountToSell,
            assetToBuy: assetToBuy,
            orderId: orderId,
            orderStatus: OrderStatus.PendingDispense
        });

        agis[orderId] = newIntent;
        emit AGIPublished(orderId, assetToSell, amountToSell, assetToBuy, 0, newIntent.orderStatus);
    }

    function viewAGI(uint256 orderId) external view returns (AgentGeneratedIntent memory) {
        return agis[orderId];
    }

    function withdrawAsset(uint256 orderId) external onlySolver {
        AgentGeneratedIntent storage intent = agis[orderId];
        require(intent.orderStatus == OrderStatus.PendingDispense, "Invalid order status");
        intent.orderStatus = OrderStatus.DispensedPendingProceeds;

        _checkBalance(intent.assetToSell, intent.amountToSell);

        SafeTransferLib.safeTransfer(ERC20(intent.assetToSell), msg.sender, intent.amountToSell);
    }

    function depositAsset(uint256 orderId, uint256 amount) external onlySolver {
        AgentGeneratedIntent storage intent = agis[orderId];
        require(intent.orderStatus == OrderStatus.DispensedPendingProceeds, "Invalid order status");
        intent.orderStatus = OrderStatus.ProceedsReceived;
        processedAGIs.push(orderId);
        SafeTransferLib.safeTransferFrom(ERC20(intent.assetToBuy), msg.sender, address(this), amount);
    }

    function processedAGIsLength() external view returns (uint256) {
        return processedAGIs.length;
    }

    /// @notice get the processed AGIs
    /// @param _start the start index
    /// @param _end the end index
    /// @return res the processed AGIs
    function getProcessedAGIs(uint256 _start, uint256 _end) external view returns (uint256[] memory res) {
        uint256 length = _end - _start;
        res = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            res[i] = processedAGIs[_start + i];
        }

        return res;
    }

    function _checkBalance(address asset, uint256 amount) internal view {
        if (asset == address(0)) {
            require(address(this).balance >= amount, "Insufficient balance");
        } else {
            require(ERC20(asset).balanceOf(address(this)) >= amount, "Insufficient balance");
        }
    }
}
