ADDCHAIN_DIR := tools/addchain
ADDCHAIN_BIN := $(ADDCHAIN_DIR)/bin/addchain

# Interactive wizard that writes every edit needed to register a new chain
# across indexer, api and explorer. Binary is gitignored — built on demand.
add-chain: $(ADDCHAIN_BIN)
	@$(ADDCHAIN_BIN) $(ARGS)

$(ADDCHAIN_BIN): $(wildcard $(ADDCHAIN_DIR)/*.go) $(ADDCHAIN_DIR)/go.mod
	@command -v go >/dev/null || { echo "go toolchain not found — install Go 1.24+"; exit 1; }
	@echo "Building addchain"
	@cd $(ADDCHAIN_DIR) && go build -o bin/addchain .

.PHONY: add-chain run-docker-testnet stop-docker-testnet build-docker-testnet run-docker-mainnet stop-docker-mainnet build-docker-mainnet

run-docker-testnet:
	@echo "Starting xcallscan on testnet (dev)"
	@docker compose -f docker-compose-testnet.yml up -d

stop-docker-testnet:
	@echo "Stopping xcallscan on testnet (dev)"
	@docker compose -f docker-compose-testnet.yml down

build-docker-testnet:
	@echo "Building xcallscan on testnet (dev)"
	@docker compose -f docker-compose-testnet.yml build --no-cache

run-docker-mainnet:
	@echo "Starting xcallscan on mainnet (dev)"
	@docker compose -f docker-compose-mainnet.yml up -d

stop-docker-mainnet:
	@echo "Stopping xcallscan on mainnet (dev)"
	@docker compose -f docker-compose-mainnet.yml down

build-docker-mainnet:
	@echo "Building xcallscan on mainnet (dev)"
	@docker compose -f docker-compose-mainnet.yml build --no-cache
