include .env
anvilDeploy:
	forge script script/Deploy.s.sol:DeployScript --rpc-url http://localhost:8545 --broadcast -vvv

baseDeploy:
	forge script script/Deploy.s.sol:DeployScript \
	--etherscan-api-key ${BASESCAN_API_KEY} \
	--rpc-url https://base-rpc.publicnode.com \
	--verify \
	--broadcast -vvv

