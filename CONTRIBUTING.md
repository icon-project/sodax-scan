# Contributing to sodax-scan

This is the entry point for anyone changing this repository. It covers how a change goes from an issue to a merged PR. [CLAUDE.md](CLAUDE.md) holds the same repo facts for AI agents.

## Rules every PR follows

These are checked automatically on every merged PR.

1. **Every PR links an issue.** Put `Closes #N` in the PR body, or `Refs owner/repo#N` for part of a larger piece of work. No issue yet? Open one first from the issue templates (Task, Bug, New chain).
2. **The PR title is a [Conventional Commit](https://www.conventionalcommits.org/):** `type(scope): subject`, for example `fix(api): handle a null partner fee`. Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `build`, `ci`, `perf`, `revert`.
3. **Changes reach `master` only through a merged PR** with at least one approving review. No direct pushes.
4. **Checks are green** when the PR merges.
5. **No secrets** (keys, tokens, passwords, `.env` files) in code, commits, issues or PRs. Security problems follow [SECURITY.md](SECURITY.md), never an issue.

## Branches

Branch from `master`, name the branch `<type>/<short-description>`, and open the PR against `master`. Keep each PR to one concern.

## Setup

The repo has three parts, each with its own package, plus a Go tool:

- `explorer/`: Next.js, installed with yarn.
- `indexer/`: TypeScript run with Bun (the Docker image uses Bun 1.1). It needs Postgres and an RPC URL per chain.
- `api/`: Express on Node 20 (the Docker image's version), installed with npm. It reads the same Postgres.
- `tools/addchain/`: Go 1.24, built on demand by `make add-chain`.

Each part reads its settings from `.env`. Copy `api/.env.example`, `explorer/.env.example` and `indexer/.env.example` to `.env` and fill them in. Never commit a `.env` file.

To run the whole stack in Docker, use `make run-docker-testnet` (or `run-docker-mainnet`).

## Before you open a PR

No CI runs in this repo, so run the checks for each part you changed:

```bash
(cd explorer && yarn lint && yarn test && yarn build)
(cd indexer && bun run lint && bun test)
(cd tools/addchain && go test ./...)
```

`api/` has no tests. Start it with `npm start` and call the endpoints you changed.

## Conventions

- Format with the repo's settings: Prettier for `explorer/` (`explorer/.prettierrc.json`) and the root, Biome for `indexer/` (`indexer/biome.json`).
- Add a chain with `make add-chain`, or follow [docs/add-new-network.md](docs/add-new-network.md). Never add a chain to only one of indexer, api and explorer.
- Document API changes in [docs/apis.md](docs/apis.md) and websocket changes in [docs/websocket.md](docs/websocket.md).
- This repo is public. Never add private code, internal hostnames or contract addresses that haven't been announced.

## Review and merge

- At least one maintainer approval is needed. Answer every review comment: fix it and reply with the commit, or say why not.
- Fill in the PR template: the linked issue, what changed and why, and how you tested it.
- Interface changes (ABI, message encoding, API response, SDK type) need the consumers updated too. List them in the linked issue.
