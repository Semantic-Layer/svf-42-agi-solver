fmt:
	pnpm fmt
	cd contracts && forge fmt

start:
	pnpm install && pnpm build && pnpm start

dev:
	@echo "start the development server with watch..."
	pnpm install
	pnpm dev

build:
	pnpm build


deploy:
	${MAKE} -C contracts anvilDeploy


publishAGI:
	@if [ -z '$(ASSET_TO_SELL)' ] || [ -z '$(AMOUNT_TO_SELL)' ] || [ -z '$(ASSET_TO_BUY)' ]; then \
		echo 'Error: Missing required parameters.'; \
		echo 'Usage: make publishAGI \'; \
		echo '  ASSET_TO_SELL=0x... \'; \
		echo '  AMOUNT_TO_SELL=1000000000000000000 \'; \
		echo '  ASSET_TO_BUY=0x... \'; \
		echo '  [ORDER_TYPE=0]'; \
		exit 1; \
	fi
	$(eval CONTRACT_ADDRESS := $(shell jq -r '.addresses.agi' contracts/deployments/agi/31337.json))
	@if [ -z '$(CONTRACT_ADDRESS)' ] || [ '$(CONTRACT_ADDRESS)' = 'null' ]; then \
		echo 'Error: Could not find contract address in deployment file'; \
		exit 1; \
	fi
	cast send $(CONTRACT_ADDRESS) \
		'publishAGI(uint8,address,uint256,address)' \
		$(if $(ORDER_TYPE),$(ORDER_TYPE),0) \
		$(ASSET_TO_SELL) \
		$(AMOUNT_TO_SELL) \
		$(ASSET_TO_BUY) \
		--rpc-url http://localhost:8545 \
		--private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

sellTokenA:
	$(eval TOKEN_A := $(shell jq -r '.addresses.tokenA' contracts/deployments/agi/31337.json))
	$(eval TOKEN_B := $(shell jq -r '.addresses.tokenB' contracts/deployments/agi/31337.json))
	@if [ -z '$(TOKEN_A)' ] || [ -z '$(TOKEN_B)' ]; then \
		echo 'Error: Could not find token addresses in deployment file'; \
		exit 1; \
	fi
	${MAKE} publishAGI \
		ASSET_TO_SELL=$(TOKEN_A) \
		AMOUNT_TO_SELL=1000000000000000000 \
		ASSET_TO_BUY=$(TOKEN_B)

