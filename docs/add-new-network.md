# Adding a New Network to sodax-scan

This guide walks through every change needed to integrate a new chain. Steps are in a logical order — complete them top to bottom.

---

## Decision checklist (answer these before you start)

| # | Question | Where it affects |
|---|----------|-----------------|
| 1 | What is the chain's **network ID (nid)**? | Deployment configs, `configs.ts`, `constants.js`, `helper.js` |
| 2 | What is the chain's **block explorer** base URL for transactions? | `api/constants.js` `META_URLS` |
| 3 | What is the chain's **native asset** symbol? | `explorer/lib/helper.js` `NETWORK_DETAILS` |
| 4 | Does this chain embed payload data on-chain, or is the payload **hashed/fetched from the relay** (like Solana/Bitcoin)? | `indexer/src/utils.ts` `srcHasHashedPayload`, and possibly a custom block in `main.ts` `parseTransactionEvent` |
| 5 | Is this chain EVM-compatible? If not, you need a **custom chain handler** | `indexer/src/chains/<name>/index.ts` |
| 6 | What are the **AssetManager address** and supported **asset addresses/decimals** for this chain? | `indexer/config.json` |

---

## Step 1 — Deployment configs (nid registration)

Add the chain's nid to all four deployment config files:

- `api/configs/mainnet_deployment.json`
- `api/configs/testnet_deployment.json`
- `explorer/configs/mainnet_deployment.json`
- `explorer/configs/testnet_deployment.json`

```json
"<chainname>": {
    "nid": "<nid>"
}
```

Use the same `<chainname>` key everywhere — it's the canonical identifier used across the codebase.

---

## Step 2 — Indexer: chain ID constant and RPC URL

In `indexer/src/configs.ts`:

1. Export the nid as a named constant at the top of the file:
   ```ts
   export const <chainname> = "<nid>"
   ```

2. Add it to `chainNameToIdMap`:
   ```ts
   <chainname>: <chainname>,
   ```

3. Add the RPC URL entry:
   ```ts
   [<chainname>]: requireEnv("<CHAINNAME>_URL"),
   ```

Then add the env var to `indexer/.env.example`:
```
<CHAINNAME>_URL=
```

---

## Step 3 — Indexer: chain handler

### 3a. If EVM-compatible

No new file needed — the existing `EVM` handler in `indexer/src/chains/evm/index.ts` will be reused. Skip to step 3b.

### 3b. If non-EVM

Create `indexer/src/chains/<chainname>/index.ts` implementing the `ChainHandler` interface. Look at existing handlers for reference:

- EVM: `indexer/src/chains/evm/index.ts`
- Solana (RPC-based, no on-chain payload): `indexer/src/chains/solana/index.ts`
- Bitcoin (JSON-RPC, fee from vin/vout): `indexer/src/chains/bitcoin/index.ts`

The handler must implement `fetchPayload(txHash, sn)` and return at minimum `{ payload, txnFee, blockNumber }`.

### 3c. Register the handler

In `indexer/src/handler.ts`, import the chain id and handler, then add it to the `handlers` map:

```ts
import { <chainname> } from "./configs";
import { <ChainName>Handler } from "./chains/<chainname>";

// inside handlers map:
[<chainname>]: new <ChainName>Handler({ rpcUrl: RPC_URLS[<chainname>] }),
```

---

## Step 4 — Indexer: asset configuration

In `indexer/config.json`, add a top-level entry for the chain:

```json
"<chainname>": {
    "AssetManager": "<asset_manager_contract_address>",
    "Assets": {
        "<asset_address>": {
            "name": "<token_symbol>",
            "decimals": <decimals>
        }
    }
}
```

> **Note:** Some chains (e.g. Bitcoin) may have multiple address representations for the same asset. Add all relevant formats as separate entries pointing to the same asset info if needed.

---

## Step 5 — Indexer: payload handling decision

> **Decision required:** Does this chain have its payload hashed or stored off-chain (like Solana and Bitcoin)?

In `indexer/src/utils.ts`, update `srcHasHashedPayload` if yes:

```ts
export function srcHasHashedPayload(srcChainId: string): boolean {
  return srcChainId === solana || srcChainId === bitcoin || srcChainId === <chainname>;
}
```

If the chain has a non-standard payload retrieval flow (like Bitcoin's relay-based lookup), add a chain-specific block in `parseTransactionEvent` inside `indexer/src/main.ts`, following the Bitcoin pattern at line 113.

---

## Step 6 — API: network constants

In `api/constants.js`:

1. Add to the `NETWORK` object:
   ```js
   <CHAINNAME>: CONFIG_NETWORKS.<chainname>.nid,
   ```

2. Add to `META_URLS.tx`:
   ```js
   [NETWORK.<CHAINNAME>]: USE_MAINNET ? 'https://<mainnet-explorer>/tx/' : 'https://<testnet-explorer>/tx/',
   ```

---

## Step 7 — Explorer: network mappings and details

In `explorer/lib/helper.js`:

1. Add to `NETWORK`:
   ```js
   <CHAINNAME>: '<chainname>',
   ```

2. Add to `NETWORK_MAPPINGS`:
   ```js
   [NETWORK.<CHAINNAME>]: CONFIG_NETWORKS.<chainname>.nid,
   ```

3. Add to `REV_NETWORK_MAPPINGS`:
   ```js
   [CONFIG_NETWORKS.<chainname>.nid]: [NETWORK.<CHAINNAME>],
   ```

4. Add to `NETWORK_DETAILS`:
   ```js
   [NETWORK.<CHAINNAME>]: {
       id: NETWORK.<CHAINNAME>,
       name: '<Display Name>',
       logo: `/images/network-<chainname>.png`,
       nativeAsset: '<SYMBOL>',
   },
   ```

---

## Step 8 — Explorer: network logo

Add the network logo image at:

```
explorer/public/images/network-<chainname>.png
```

Follow the existing naming convention. PNG format, consistent sizing with other network logos.

---

## Summary checklist

- [ ] `api/configs/mainnet_deployment.json` — add nid
- [ ] `api/configs/testnet_deployment.json` — add nid
- [ ] `explorer/configs/mainnet_deployment.json` — add nid
- [ ] `explorer/configs/testnet_deployment.json` — add nid
- [ ] `indexer/src/configs.ts` — add chain constant, `chainNameToIdMap` entry, `RPC_URLS` entry
- [ ] `indexer/.env.example` — add `<CHAINNAME>_URL=`
- [ ] `indexer/src/chains/<chainname>/index.ts` — new handler (non-EVM only)
- [ ] `indexer/src/handler.ts` — register handler
- [ ] `indexer/config.json` — add AssetManager + Assets
- [ ] `indexer/src/utils.ts` — update `srcHasHashedPayload` if payload is relay-fetched
- [ ] `indexer/src/main.ts` — add chain-specific block in `parseTransactionEvent` if needed
- [ ] `api/constants.js` — add to `NETWORK` and `META_URLS`
- [ ] `explorer/lib/helper.js` — add to `NETWORK`, `NETWORK_MAPPINGS`, `REV_NETWORK_MAPPINGS`, `NETWORK_DETAILS`
- [ ] `explorer/public/images/network-<chainname>.png` — add logo
