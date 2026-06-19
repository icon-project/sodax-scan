# Indexer build/deploy helpers.
#
# The hub-intents poller reads its start block from ./.cursors/sonic_hub_intents.json
# (the "lastBlock" field) and resumes from there. We bind-mount ./.cursors into
# the container so that file persists across redeploys and you can edit it
# directly. To change where the poller starts: stop it, edit lastBlock, start.

IMAGE      ?= indexer
CONTAINER  ?= sodax-indexer
CURSOR_DIR ?= $(CURDIR)/.cursors

.PHONY: build stop run deploy logs

build:
	@echo "Building $(IMAGE) image"
	@docker build -t $(IMAGE) .

stop:
	@echo "Stopping and removing $(CONTAINER) (if present)"
	-@docker stop $(CONTAINER)
	-@docker rm $(CONTAINER)

run:
	@mkdir -p $(CURSOR_DIR)
	@echo "Starting $(CONTAINER) (cursor: $(CURSOR_DIR)/sonic_hub_intents.json)"
	@docker run -d --name $(CONTAINER) -v "$(CURSOR_DIR):/app/.cursors" $(IMAGE)

# Full redeploy: rebuild, replace the container, keep the cursor file.
deploy: build stop run
	@echo "Deployed."

logs:
	@docker logs -f --tail 100 $(CONTAINER)
