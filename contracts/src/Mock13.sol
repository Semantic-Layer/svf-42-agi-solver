// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "solmate/tokens/ERC20.sol";
import "solmate/utils/SafeTransferLib.sol";
import {Owned} from "solmate/auth/Owned.sol";
import {MockMaster42} from "./MockMaster42.sol";
import {MockVesting} from "./MockVesting.sol";

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

    /// @notice reference to Master42 contract
    MockMaster42 public master42;

    /// @notice reference to vesting contract
    MockVesting public vesting;

    /// @dev 10 =>10*100%/1000=>1%, 250 => 250*100%/1000=>25%
    uint32 constant PRECISION = 1000;

    /// @dev a unique index for tracking token portfolio
    /// 0 is preserved for svf token. index for other assets start from 0
    uint32 public nextIndex;

    // ---------- configs ----------
    /// @dev the cool down between two withdrawAsset.
    uint256 public cooldown;

    // Restrictions
    // below are percentage values
    uint256 public maxCostBasisPerAssetPercent; // 5.0%
    uint256 public maxCostBasisPerTradePercent; // 1.7%
    uint256 public maxDeploymentSizePerDayPercent; // 5.0%
    uint256 public maxTotalDeploymentPercent; // 50%
    uint256 public lastDeploymentDay; // Tracks the last deployment day per asset
    uint256 public dailyDeployment; // Tracks deployment per day
    uint256 public totalDeployment; // Tracks total deployment per asset
    uint256 public initialBalance;

    // --------- portfolio related ----------
    /// @dev it tracks the timestamp when ai agent make a purchase of this token
    mapping(address token => uint256 timestamp) lastPurchasedTime;

    /// @dev it tracks the token address to each index
    mapping(address token => uint32 index) tokenToIndex;
    mapping(uint32 index => address token) indexToToken;

    /// @dev it tracks the token hold in ai agent vault portfolio
    mapping(address token => uint256 amount) public portfolio;

    /// @dev only tokens listed in the whitelist are eligible for interaction
    mapping(address token => bool isWhitelistToken) public whitelistToken;

    // Enum to represent order status
    enum OrderStatus {
        // pending to dispense asset to sell
        PendingDispense,
        // asset to sell is dispensed but pending deposit of proceeds
        DispensedPendingProceeds,
        // proceeds received
        ProceedsReceived
    }

    // Add CheckStatus enum
    enum CheckStatus {
        AllChecksPassed,
        CostBasisPerTradeLimitExceeded,
        DailyDeploymentSizeLimitExceeded,
        TotalDeploymentSizeLimitExceeded,
        NewlyPurchasedAssetsCannotSellIn7Days
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

    modifier onlyAIOrOwnerOrMaster42() {
        require(msg.sender == ai || msg.sender == owner || msg.sender == address(master42), "Not authorized");
        _;
    }

    modifier noZeroAddress(address _address) {
        require(_address != address(0), "Zero address");
        _;
    }

    modifier noZeroValue(uint256 _value) {
        require(_value != 0, "Zero value");
        _;
    }

    modifier invalidPercent(uint256 _value) {
        require(_value <= PRECISION, "Invalid percent");
        _;
    }

    modifier onlyWhitelistToken(address _token) {
        require(whitelistToken[_token], "Not whitelisted token");
        _;
    }

    modifier assignTokenIndex(address _assetToSell, address _assetToBuy) {
        if (tokenToIndex[_assetToSell] == 0) {
            uint32 currIndex = nextIndex++;
            tokenToIndex[_assetToSell] = currIndex;
            indexToToken[currIndex] = _assetToSell;
            uint256 assetToSellBalance = ERC20(_assetToSell).balanceOf(address(this));
            if (assetToSellBalance == 0) revert("Insufficient balance");
            portfolio[_assetToSell] = assetToSellBalance;
        }

        if (tokenToIndex[_assetToBuy] == 0) {
            uint32 currIndex = nextIndex++;
            tokenToIndex[_assetToBuy] = currIndex;
            indexToToken[currIndex] = _assetToBuy;
            uint256 assetToBuyBalance = ERC20(_assetToBuy).balanceOf(address(this));
            portfolio[_assetToBuy] = assetToBuyBalance;
        }
        _;
    }

    constructor(address owner_, address ai_) Owned(owner_) {
        ai = ai_;

        // just for testing. set the owner as a solver
        isSolver[owner_] = true;
        isSolver[ai_] = true;

        // Initialize config values
        cooldown = 0; // Set cooldown to zero to disable it
        maxCostBasisPerAssetPercent = 50;
        maxCostBasisPerTradePercent = 17;
        maxDeploymentSizePerDayPercent = 50;
        maxTotalDeploymentPercent = 500;

        // Set a default initial balance for testing (e.g., 1 million tokens with 18 decimals)
        initialBalance = 1_000_000 * 10 ** 18;
    }

    function setMaster42(address master42_) external onlyOwner {
        master42 = MockMaster42(master42_);
    }

    /// @notice set the address of the solver
    function setAGISolverAddress(address newSolver_, bool isSolver_) external onlyOwner {
        isSolver[newSolver_] = isSolver_;
    }

    function setWhitelistTokens(address[] calldata _tokens, bool[] calldata _status) external onlyOwner {
        uint256 tokensLen = _tokens.length;
        uint256 statusLen = _status.length;
        require(tokensLen == statusLen && tokensLen != 0, "Invalid input length");

        for (uint256 i = 0; i < tokensLen; i++) {
            whitelistToken[_tokens[i]] = _status[i];
        }
    }

    /// @notice publish a new AGI
    function publishAGI(uint8 _orderType, address assetToSell, uint256 amountToSell, address assetToBuy)
        external
        onlyAIOrOwnerOrMaster42
        noZeroValue(amountToSell)
        onlyWhitelistToken(assetToSell)
        onlyWhitelistToken(assetToBuy)
        assignTokenIndex(assetToSell, assetToBuy)
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

        // Check cooldown period for non-SVF assets
        if (intent.assetToSell != address(0)) {
            require(block.timestamp >= lastPurchasedTime[intent.assetToSell] + cooldown, "Cooldown not over");
        }

        // Update portfolio for non-SVF assets
        if (intent.assetToSell != address(0)) {
            portfolio[intent.assetToSell] -= intent.amountToSell;
        }

        SafeTransferLib.safeTransfer(ERC20(intent.assetToSell), msg.sender, intent.amountToSell);
    }

    function depositAsset(uint256 orderId, uint256 amount) external onlySolver {
        AgentGeneratedIntent storage intent = agis[orderId];
        require(intent.orderStatus == OrderStatus.DispensedPendingProceeds, "Invalid order status");
        intent.orderStatus = OrderStatus.ProceedsReceived;
        processedAGIs.push(orderId);

        // Update portfolio for non-SVF assets
        if (intent.assetToBuy != address(0)) {
            portfolio[intent.assetToBuy] += amount;
            lastPurchasedTime[intent.assetToBuy] = block.timestamp;
        }

        SafeTransferLib.safeTransferFrom(ERC20(intent.assetToBuy), msg.sender, address(this), amount);
    }

    function _enforceWithdrawLimits(uint256 svfAmount) internal {
        uint256 currentDay = block.timestamp / 1 days;
        uint256 totalAvailableSVF = initialBalance;

        // 1. Ensure cost basis per trade does not exceed limit
        if (svfAmount > totalAvailableSVF * maxCostBasisPerTradePercent / PRECISION) {
            revert("Exceed cost basis per trade");
        }

        // 2. Ensure daily deployment does not exceed limit
        if (lastDeploymentDay != currentDay) {
            dailyDeployment = 0;
            lastDeploymentDay = currentDay;
        }
        dailyDeployment += svfAmount;

        if (dailyDeployment > totalAvailableSVF * maxDeploymentSizePerDayPercent / PRECISION) {
            revert("Exceed daily deployment limit");
        }

        // 3. Ensure total deployment does not exceed limit
        totalDeployment += svfAmount;

        if (totalDeployment > totalAvailableSVF * maxTotalDeploymentPercent / PRECISION) {
            revert("Exceed total deployment limit");
        }
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

    // View functions for portfolio
    function indexToPortfolio(uint32 _index) external view returns (address _token, uint256 _portfolioAmount) {
        _token = indexToToken[_index];
        _portfolioAmount = portfolio[_token];
    }

    function tokenToPortfolio(address _token) external view returns (uint32 _index, uint256 _portfolioAmount) {
        _index = tokenToIndex[_token];
        _portfolioAmount = portfolio[_token];
    }

    /**
     * @dev Checks if the given deployment amount adheres to the defined limits.
     * @param _isSell Whether the deployment is a sell.
     * @param _amount The amount of the deployment.
     * @param _asset The address of the asset being deployed.
     * @return _status status code indicating the result of the check
     */
    function checkLimits(bool _isSell, uint256 _amount, address _asset)
        external
        view
        onlyWhitelistToken(_asset)
        returns (CheckStatus _status)
    {
        uint256 currentDay = block.timestamp / 1 days;
        uint256 totalAvailableSVF = initialBalance;

        // Add vested amount if vesting contract is set
        if (address(vesting) != address(0)) {
            totalAvailableSVF += vesting.totalVested();
        }

        if (_isSell == false) {
            if (_amount > totalAvailableSVF * maxCostBasisPerTradePercent / PRECISION) {
                return CheckStatus.CostBasisPerTradeLimitExceeded;
            }

            // Ensure daily deployment does not exceed limit
            uint256 _dailyDeployment = dailyDeployment;
            if (lastDeploymentDay != currentDay) {
                _dailyDeployment = 0;
            }

            _dailyDeployment += _amount;

            if (_dailyDeployment > totalAvailableSVF * maxDeploymentSizePerDayPercent / PRECISION) {
                return CheckStatus.DailyDeploymentSizeLimitExceeded;
            }

            // Ensure total deployment does not exceed limit
            uint256 _totalDeployment = totalDeployment + _amount;

            if (_totalDeployment > totalAvailableSVF * maxTotalDeploymentPercent / PRECISION) {
                return CheckStatus.TotalDeploymentSizeLimitExceeded;
            }
        } else {
            // Ensure cooldown period has passed since last purchase
            if (block.timestamp < lastPurchasedTime[_asset] + cooldown) {
                return CheckStatus.NewlyPurchasedAssetsCannotSellIn7Days;
            }
        }
        return CheckStatus.AllChecksPassed;
    }

    /// @notice Set the initial balance for testing
    /// @dev Only callable by owner
    function setInitialBalance(uint256 _initialBalance) external onlyOwner {
        initialBalance = _initialBalance;
    }

    /// @notice Set the vesting contract address
    /// @dev Only callable by owner
    function setVesting(address _vesting) external onlyOwner {
        vesting = MockVesting(_vesting);
    }
}
