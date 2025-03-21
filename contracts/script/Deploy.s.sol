// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {Mock13} from "../src/Mock13.sol";
import {TokenA} from "../src/TokenA.sol";
import {TokenB} from "../src/TokenB.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Deploy TokenA and TokenB
        TokenA tokenA = new TokenA();
        TokenB tokenB = new TokenB();

        // Deploy Mock13
        Mock13 mock13 = new Mock13();

        // Mint some tokens for testing
        tokenA.mint(address(mock13), 1000 * 1e18);
        tokenB.mint(address(mock13), 1000 * 1e18);

        // Log the addresses
        console.log("TokenA deployed to:", address(tokenA));
        console.log("TokenB deployed to:", address(tokenB));
        console.log("Mock13 deployed to:", address(mock13));

        vm.stopBroadcast();
    }
}
