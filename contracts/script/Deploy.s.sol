// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {Mock13} from "../src/Mock13.sol";
import {TokenA} from "../src/TokenA.sol";
import {TokenB} from "../src/TokenB.sol";

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract DeployScript is Script {
    using Strings for *;

    address constant SVF_TOKEN = 0x637043af1A83e83e5A7D2BAcA4ABD1aA6c39E026;

    struct DeploymentData {
        address agiContract;
        address tokenA;
        address tokenB;
        address constructor_owner;
        address constructor_ai;
    }

    DeploymentData public deploymentData; // State variable to hold the struct
    // misc

    function run() external {
        uint256 deployerPrivateKey;
        if (block.chainid == 8453) {
            // Base Mainnet
            deployerPrivateKey = vm.envUint("BASE_DEPLOYER_PRIVATE_KEY");
        } else {
            deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        }
        address deployer = vm.addr(deployerPrivateKey);
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        vm.startBroadcast(deployerPrivateKey);

        // Deploy TokenA and TokenB
        TokenA tokenA = new TokenA();
        TokenB tokenB = new TokenB();

        // Deploy Mock13
        Mock13 mock13 = new Mock13(deployer, deployer);

        // Mint some tokens for testing
        tokenA.mint(address(mock13), 1000000 * 1e18);
        tokenB.mint(address(mock13), 1000000 * 1e18);
        tokenA.mint(deployer, 1000000 * 1e18);
        tokenB.mint(deployer, 1000000 * 1e18);

        // Set token allowances
        tokenA.approve(address(mock13), type(uint256).max);
        tokenB.approve(address(mock13), type(uint256).max);
        // TokenA(SVF_TOKEN).approve(address(mock13), type(uint256).max);

        // Log the addresses
        console.log("TokenA deployed to:", address(tokenA));
        console.log("TokenB deployed to:", address(tokenB));
        console.log("Mock13 deployed to:", address(mock13));

        // save deployment data to json file
        deploymentData = DeploymentData(address(mock13), address(tokenA), address(tokenB), deployer, deployer);
        writeDeploymentJson(deploymentData);

        vm.stopBroadcast();
    }

    function writeDeploymentJson(DeploymentData memory data) internal {
        writeDeploymentJson("deployments/agi/", block.chainid, data);
    }

    function writeDeploymentJson(string memory path, uint256 chainId, DeploymentData memory data) internal {
        string memory deploymentDataJson = _generateDeploymentJson(data);

        string memory fileName = string.concat(path, vm.toString(chainId), ".json");
        if (!vm.exists(path)) {
            vm.createDir(path, true);
        }

        vm.writeFile(fileName, deploymentDataJson);
        console2.log("Deployment artifacts written to:", fileName);
    }

    function _generateDeploymentJson(DeploymentData memory data) private view returns (string memory) {
        return string.concat(
            '{"lastUpdate":{"timestamp":"',
            vm.toString(block.timestamp),
            '","block_number":"',
            vm.toString(block.number),
            '"},"deployer":"',
            msg.sender.toHexString(),
            '","constructorArgs":{',
            _generateConstructorArgsJson(data),
            '},"addresses":',
            _generateContractsJson(data),
            "}"
        );
    }

    function _generateConstructorArgsJson(DeploymentData memory data) private pure returns (string memory) {
        return string.concat(
            '"dao":"', data.constructor_owner.toHexString(), '","ai":"', data.constructor_ai.toHexString(), '"'
        );
    }

    function _generateContractsJson(DeploymentData memory data) private pure returns (string memory) {
        return string.concat(
            '{"agi":"',
            data.agiContract.toHexString(),
            '","tokenA":"',
            data.tokenA.toHexString(),
            '","tokenB":"',
            data.tokenB.toHexString(),
            '"}'
        );
    }
}
