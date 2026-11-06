# Contributing to sodax-scan

This is the entry point for anyone changing this repository. It covers how a change goes from an issue to a merged PR. [CLAUDE.md](CLAUDE.md) holds the same repo facts for AI agents.

## Rules every PR follows

These are checked automatically on every merged PR.

1. **Every PR links an issue.** Put `Closes #N` in the PR body, or `Refs owner/repo#N` for part of a larger piece of work. No issue yet? Open one first from the issue templates (Task, Bug, New chain, New token, New venue).
2. **The PR title is a [Conventional Commit](https://www.conventionalcommits.org/):** `type(scope): subject`, for example `fix(api): handle a null partner fee`. Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `build`, `ci`, `perf`, `revert`.
3. **Changes reach `master` only through a merged PR** with at least one approving review. No direct pushes.
4. **Checks are green** when the PR merges.
5. **No secrets** (keys, tokens, passwords, `.env` files) in code, commits, issues or PRs. Security problems follow [SECURITY.md](SECURITY.md), never an issue.

## Branches

Branch from `master`, name the branch `<type>/<short-description>`, and open the PR against `master`. Keep each PR to one concern.

## Setup

<!-- TODO(owner): The toolchain and versions (Node, pnpm, Rust, Go, Foundry...), how to install, and any local services or env vars needed (point at the example env file, never real values). -->

## Before you open a PR

<!-- TODO(owner): The exact commands to run, in order, for example:
```bash
pnpm lint && pnpm build && pnpm test
```
-->

## Conventions

<!-- TODO(owner): The rules a reviewer will hold you to in this repo: code style, patterns to follow, things never to do. Link to longer docs instead of repeating them. -->

## Review and merge

- At least one maintainer approval is needed. Answer every review comment: fix it and reply with the commit, or say why not.
- Fill in the PR template: the linked issue, what changed and why, and how you tested it.
- Interface changes (ABI, message encoding, API response, SDK type) need the consumers updated too. List them in the linked issue.
