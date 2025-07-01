include .env
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

# ------------------------------------ Mock test -------------------------------------
publishAGI:
	@if [ -z '$(ASSET_TO_SELL)' ] || [ -z '$(AMOUNT_TO_SELL)' ] || [ -z '$(ASSET_TO_BUY)' ]; then \
		echo 'Error: Missing required parameters.'; \
		echo 'Usage: make publishAGI \'; \
		echo '  ASSET_TO_SELL=0x... \'; \
		echo '  AMOUNT_TO_SELL=100000000000000000000 \'; \
		echo '  ASSET_TO_BUY=0x... \'; \
		echo '  [ORDER_TYPE=0]'; \
		exit 1; \
	fi
	@if [ -z '$(CHAIN_ID)' ]; then \
		echo 'Error: CHAIN_ID environment variable is not set'; \
		exit 1; \
	fi
	$(eval CONTRACT_ADDRESS := $(shell jq -r '.addresses.agi' contracts/deployments/agi/$(CHAIN_ID).json))
	@if [ -z '$(CONTRACT_ADDRESS)' ] || [ '$(CONTRACT_ADDRESS)' = 'null' ]; then \
		echo 'Error: Could not find contract address in deployment file for chain ID $(CHAIN_ID)'; \
		exit 1; \
	fi
	@if [ -z '$(PRIVATE_KEY)' ]; then \
		echo 'Error: PRIVATE_KEY environment variable is not set'; \
		exit 1; \
	fi
	@if [ -z '$(RPC)' ]; then \
		echo 'Error: RPC_URL environment variable is not set'; \
		exit 1; \
	fi
	cast send $(CONTRACT_ADDRESS) \
		'publishAGI(uint8,address,uint256,address)' \
		$(if $(ORDER_TYPE),$(ORDER_TYPE),0) \
		$(ASSET_TO_SELL) \
		$(AMOUNT_TO_SELL) \
		$(ASSET_TO_BUY) \
		--rpc-url $(RPC) \
		--private-key $(PRIVATE_KEY)

sellTokenA:
	@if [ -z '$(CHAIN_ID)' ]; then \
		echo 'Error: CHAIN_ID environment variable is not set'; \
		exit 1; \
	fi
	$(eval TOKEN_A := $(shell jq -r '.addresses.tokenA' contracts/deployments/agi/$(CHAIN_ID).json))
	$(eval TOKEN_B := $(shell jq -r '.addresses.tokenB' contracts/deployments/agi/$(CHAIN_ID).json))
	@if [ -z '$(TOKEN_A)' ] || [ -z '$(TOKEN_B)' ]; then \
		echo 'Error: Could not find token addresses in deployment file for chain ID $(CHAIN_ID)'; \
		exit 1; \
	fi
	${MAKE} publishAGI \
		ASSET_TO_SELL=$(TOKEN_A) \
		AMOUNT_TO_SELL=100000000000000000000 \
		ASSET_TO_BUY=$(TOKEN_B)

sellTokenB:
	@if [ -z '$(CHAIN_ID)' ]; then \
		echo 'Error: CHAIN_ID environment variable is not set'; \
		exit 1; \
	fi
	$(eval TOKEN_A := $(shell jq -r '.addresses.tokenA' contracts/deployments/agi/$(CHAIN_ID).json))
	$(eval TOKEN_B := $(shell jq -r '.addresses.tokenB' contracts/deployments/agi/$(CHAIN_ID).json))
	@if [ -z '$(TOKEN_A)' ] || [ -z '$(TOKEN_B)' ]; then \
		echo 'Error: Could not find token addresses in deployment file for chain ID $(CHAIN_ID)'; \
		exit 1; \
	fi
	${MAKE} publishAGI \
		ASSET_TO_SELL=$(TOKEN_B) \
		AMOUNT_TO_SELL=100000000000000000000 \
		ASSET_TO_BUY=$(TOKEN_A)

# BUY TOKEN C with token B
buyTokenC:
	@if [ -z '$(CHAIN_ID)' ]; then \
		echo 'Error: CHAIN_ID environment variable is not set'; \
		exit 1; \
	fi
	$(eval TOKEN_B := $(shell jq -r '.addresses.tokenB' contracts/deployments/agi/$(CHAIN_ID).json))
	@if [ -z '$(TOKEN_B)' ]; then \
		echo 'Error: Could not find token B address in deployment file for chain ID $(CHAIN_ID)'; \
		exit 1; \
	fi
	${MAKE} publishAGI \
		ASSET_TO_SELL=$(TOKEN_B) \
		AMOUNT_TO_SELL=100000000000000000000 \
		ASSET_TO_BUY=0x96A98D61bCcb783160D296F107c30D0e90b2Abea

# SELL TOKEN C with token B
sellTokenC:
	@if [ -z '$(CHAIN_ID)' ]; then \
		echo 'Error: CHAIN_ID environment variable is not set'; \
		exit 1; \
	fi
	$(eval TOKEN_B := $(shell jq -r '.addresses.tokenB' contracts/deployments/agi/$(CHAIN_ID).json))
	@if [ -z '$(TOKEN_B)' ]; then \
		echo 'Error: Could not find token B address in deployment file for chain ID $(CHAIN_ID)'; \
		exit 1; \
	fi
	${MAKE} publishAGI \
		ASSET_TO_SELL=0x96A98D61bCcb783160D296F107c30D0e90b2Abea \
		AMOUNT_TO_SELL=100000000000000000000 \
		ASSET_TO_BUY=$(TOKEN_B)

