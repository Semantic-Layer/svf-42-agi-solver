// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {Mock13} from "../src/Mock13.sol";

contract PublishAGIScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address MOCK13_ADDRESS = vm.envAddress("MOCK13_ADDRESS");
        address TOKEN_A_ADDRESS = vm.envAddress("TOKEN_A_ADDRESS");
        address TOKEN_B_ADDRESS = vm.envAddress("TOKEN_B_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        Mock13 mock13 = Mock13(MOCK13_ADDRESS);

        // Publish an AGI to trade TokenA for TokenB
        mock13.publishAGI(
            0, // intentType (0 for trade)
            TOKEN_A_ADDRESS, // assetToSell
            100 * 1e18, // amountToSell (100 tokens)
            TOKEN_B_ADDRESS // assetToBuy
        );

        console.log("AGI published successfully");

        vm.stopBroadcast();
    }
}
