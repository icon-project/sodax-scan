package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// fileChange is one pending write. Nothing touches disk until every change in
// the plan has been produced without error.
type fileChange struct {
	Path    string // repo-relative
	Updated []byte
	IsNew   bool
	Note    string
}

type plan struct {
	Changes []fileChange
	Skipped []fileChange // nothing to do — already correct, not a failure
	Errors  []string
	Todos   []string
}

type transform func(string) (string, error)

// errAlreadyPresent lets a transform say "this file already says what it should"
// — a legitimate skip (e.g. the chain's native asset shares a coingecko id with
// a chain that's already listed), as opposed to a failed edit.
var errAlreadyPresent = errors.New("already present")

type builder struct {
	root string
	p    *plan
}

// edit loads a file, applies each transform in order, and queues the result.
func (b *builder) edit(rel, note string, fns ...transform) {
	abs := filepath.Join(b.root, rel)
	raw, err := os.ReadFile(abs)
	if err != nil {
		b.p.Errors = append(b.p.Errors, fmt.Sprintf("%s: %v", rel, err))
		return
	}
	src := string(raw)
	for i, fn := range fns {
		out, err := fn(src)
		if errors.Is(err, errAlreadyPresent) {
			b.p.Skipped = append(b.p.Skipped, fileChange{Path: rel, Note: "already correct — left alone"})
			return
		}
		if err != nil {
			b.p.Errors = append(b.p.Errors, fmt.Sprintf("%s (edit %d): %v", rel, i+1, err))
			return
		}
		src = out
	}
	if src == string(raw) {
		b.p.Errors = append(b.p.Errors, fmt.Sprintf("%s: no change produced (already added?)", rel))
		return
	}
	if strings.HasSuffix(rel, ".json") && !json.Valid([]byte(src)) {
		b.p.Errors = append(b.p.Errors, fmt.Sprintf("%s: edit produced invalid JSON", rel))
		return
	}
	b.p.Changes = append(b.p.Changes, fileChange{Path: rel, Updated: []byte(src), Note: note})
}

func (b *builder) create(rel, note string, content []byte) {
	abs := filepath.Join(b.root, rel)
	if _, err := os.Stat(abs); err == nil {
		b.p.Errors = append(b.p.Errors, fmt.Sprintf("%s: already exists", rel))
		return
	}
	b.p.Changes = append(b.p.Changes, fileChange{Path: rel, Updated: content, IsNew: true, Note: note})
}

var constLineRe = regexp.MustCompile(`(?m)^export const [a-z][a-z0-9_]* = "[0-9]+"\s*$`)

// loadExistingChains reads indexer/src/configs.ts, the single source of truth
// for which chains exist, and returns key -> nid.
func loadExistingChains(root string) (map[string]string, error) {
	raw, err := os.ReadFile(filepath.Join(root, "indexer/src/configs.ts"))
	if err != nil {
		return nil, err
	}
	out := map[string]string{}
	re := regexp.MustCompile(`(?m)^export const ([a-z][a-z0-9_]*) = "([0-9]+)"`)
	for _, m := range re.FindAllStringSubmatch(string(raw), -1) {
		out[m[1]] = m[2]
	}
	return out, nil
}

func buildPlan(root string, s ChainSpec) *plan {
	p := &plan{}
	b := &builder{root: root, p: p}

	// Guard the re-run case up front. None of the append helpers know what's
	// already in the file, so without this a second run would happily add a
	// duplicate JSON key and a duplicate map entry. The wizard also checks this
	// per keystroke; this covers -spec runs and a tree patched by hand.
	existing, err := loadExistingChains(root)
	if err != nil {
		p.Errors = append(p.Errors, fmt.Sprintf("reading existing chains: %v", err))
		return p
	}
	if nid, dup := existing[s.Key]; dup {
		p.Errors = append(p.Errors, fmt.Sprintf("chain %q is already registered in indexer/src/configs.ts (nid %s)", s.Key, nid))
		return p
	}
	for k, nid := range existing {
		if nid == s.NID {
			p.Errors = append(p.Errors, fmt.Sprintf("nid %s is already used by %q", s.NID, k))
			return p
		}
	}

	// ---- deployment configs: nid registration (must land before the code that
	// reads CONFIG_NETWORKS.<key>.nid, or api/explorer crash at require time).
	nidEntry := fmt.Sprintf("        %q: {\n            \"nid\": %q\n        }", s.Key, s.NID)
	for _, rel := range []string{
		"api/configs/mainnet_deployment.json",
		"api/configs/testnet_deployment.json",
		"explorer/configs/mainnet_deployment.json",
		"explorer/configs/testnet_deployment.json",
	} {
		b.edit(rel, "nid registration", func(src string) (string, error) {
			return appendEntry(src, nidEntry, `"networks": {`, `"networks":{`)
		})
	}

	// ---- indexer: chain constant, name->id map, RPC url
	b.edit("indexer/src/configs.ts", "chain const + chainNameToIdMap + RPC_URLS",
		func(src string) (string, error) {
			line := fmt.Sprintf("export const %s = %q", s.Key, s.NID)
			return insertAfterLastLineMatching(src, line, constLineRe.MatchString)
		},
		func(src string) (string, error) {
			return appendEntry(src, fmt.Sprintf("  %s: %s,", s.Key, s.Key),
				"const chainNameToIdMap: Record<string, string> = {")
		},
		func(src string) (string, error) {
			return appendEntry(src, fmt.Sprintf("  [%s]: requireEnv(%q),", s.Key, s.EnvVar()),
				"export const RPC_URLS: Record<string, string> = {")
		},
	)

	// ---- indexer: env var. requireEnv throws at module load, so a missing var
	// takes the whole indexer down, not just this chain.
	b.edit("indexer/.env.example", "RPC env var", func(src string) (string, error) {
		return insertBeforeLineMatching(src, s.EnvVar()+"=", func(l string) bool {
			return strings.HasPrefix(l, "SCANNER_URL=")
		})
	})

	// ---- indexer: handler registration
	handlerEdits := []transform{
		func(src string) (string, error) {
			return addToImportList(src, "from './configs.ts'", s.Key)
		},
	}
	if !s.EVM {
		handlerEdits = append(handlerEdits, func(src string) (string, error) {
			imp := fmt.Sprintf("import { %s } from './chains/%s/index.ts';", s.HandlerClass(), s.Key)
			return insertAfterLastLineMatching(src, imp, func(l string) bool {
				return strings.HasPrefix(l, "import {") && strings.Contains(l, "./chains/")
			})
		})
	}
	handlerEdits = append(handlerEdits, func(src string) (string, error) {
		var entry string
		if s.EVM {
			entry = fmt.Sprintf("    [%s]: new EvmHandler({ rpcUrl: RPC_URLS[%s], denom: %q }),", s.Key, s.Key, s.NativeSymbol)
		} else {
			entry = fmt.Sprintf("    [%s]: new %s({ rpcUrl: RPC_URLS[%s] }),", s.Key, s.HandlerClass(), s.Key)
		}
		return appendEntry(src, entry, "const handlers: Record<string, ChainHandler> = {")
	})
	b.edit("indexer/src/handler.ts", "handler registration", handlerEdits...)

	// ---- indexer: spoke-side assets
	b.edit("indexer/config.json", "AssetManager + assets", func(src string) (string, error) {
		return appendToBlock(src, strings.IndexByte(src, '{'), assetsEntry(s))
	})

	// ---- indexer: payload retrieval flavour
	if s.HashedPayload {
		b.edit("indexer/src/utils.ts", "srcHasHashedPayload",
			func(src string) (string, error) {
				return addToImportList(src, `from "./configs"`, s.Key)
			},
			func(src string) (string, error) {
				fn := strings.Index(src, "export function srcHasHashedPayload")
				if fn < 0 {
					return "", fmt.Errorf("srcHasHashedPayload not found")
				}
				ret := strings.Index(src[fn:], "return ")
				if ret < 0 {
					return "", fmt.Errorf("srcHasHashedPayload has no return")
				}
				end := strings.Index(src[fn+ret:], ";")
				if end < 0 {
					return "", fmt.Errorf("srcHasHashedPayload return is unterminated")
				}
				at := fn + ret + end
				return src[:at] + fmt.Sprintf(" || srcChainId === %s", s.Key) + src[at:], nil
			},
		)
	}

	// ---- indexer: non-EVM handler scaffold
	if !s.EVM {
		b.create(fmt.Sprintf("indexer/src/chains/%s/index.ts", s.Key), "handler scaffold (TODOs inside)",
			[]byte(handlerScaffold(s)))
	}

	// ---- api: NETWORK id + explorer tx url
	b.edit("api/constants.js", "NETWORK + META_URLS.tx",
		func(src string) (string, error) {
			return appendEntry(src, fmt.Sprintf("    %s: CONFIG_NETWORKS.%s.nid,", s.UpperKey(), s.Key),
				"const NETWORK = {")
		},
		func(src string) (string, error) {
			entry := fmt.Sprintf("        [NETWORK.%s]: USE_MAINNET ? '%s' : '%s',", s.UpperKey(), s.MainnetTxURL, s.TestnetTxURL)
			return appendNestedEntry(src, entry, "const META_URLS = {", "tx: {")
		},
	)

	// ---- explorer: the four network maps
	b.edit("explorer/lib/helper.js", "NETWORK, NETWORK_MAPPINGS, REV_NETWORK_MAPPINGS, NETWORK_DETAILS",
		func(src string) (string, error) {
			return appendEntry(src, fmt.Sprintf("    %s: '%s',", s.UpperKey(), s.Key), "const NETWORK = {")
		},
		func(src string) (string, error) {
			return appendEntry(src, fmt.Sprintf("    [NETWORK.%s]: CONFIG_NETWORKS.%s.nid,", s.UpperKey(), s.Key),
				"const NETWORK_MAPPINGS = {")
		},
		func(src string) (string, error) {
			return appendEntry(src, fmt.Sprintf("    [CONFIG_NETWORKS.%s.nid]: [NETWORK.%s],", s.Key, s.UpperKey()),
				"const REV_NETWORK_MAPPINGS = {")
		},
		func(src string) (string, error) {
			// logo points at the .png: lib/render.js hardcodes the .png path for
			// list rows and hash links, so the png must exist regardless — one
			// filename for both keeps them from drifting.
			entry := fmt.Sprintf("    [NETWORK.%s]: {\n        id: NETWORK.%s,\n        name: '%s',\n        logo: `/images/network-%s.png`,\n        nativeAsset: '%s',\n    },",
				s.UpperKey(), s.UpperKey(), s.DisplayName, s.Key, s.NativeSymbol)
			return appendEntry(src, entry, "const NETWORK_DETAILS = {")
		},
	)

	// ---- explorer: native asset price lookup (optional)
	if s.CoingeckoID != "" {
		b.edit("explorer/lib/fetch-data.js", "coingecko native asset id", func(src string) (string, error) {
			const anchor = "const assetIds = `"
			idx := strings.Index(src, anchor)
			if idx < 0 {
				return "", fmt.Errorf("assetIds literal not found")
			}
			end := strings.IndexByte(src[idx+len(anchor):], '`')
			if end < 0 {
				return "", fmt.Errorf("assetIds literal unterminated")
			}
			at := idx + len(anchor) + end
			// Exact list membership, not substring: "sol" must still be added
			// even though "solana" is in the list. Chains sharing a native asset
			// (every ETH L2) legitimately share an id, hence the skip.
			for _, id := range strings.Split(src[idx+len(anchor):at], ",") {
				if strings.TrimSpace(id) == s.CoingeckoID {
					return "", errAlreadyPresent
				}
			}
			return src[:at] + "," + s.CoingeckoID + src[at:], nil
		})
	}

	// ---- explorer: logo assets
	if s.LogoSource != "" {
		png, svg, err := buildLogo(s.LogoSource)
		if err != nil {
			p.Errors = append(p.Errors, fmt.Sprintf("logo: %v", err))
		} else {
			b.create(fmt.Sprintf("explorer/public/images/network-%s.png", s.Key), "logo (360x360 png)", png)
			if svg != nil {
				b.create(fmt.Sprintf("explorer/public/images/network-%s.svg", s.Key), "logo (vector source)", svg)
			}
		}
	}

	p.Todos = todos(s)
	return p
}

func assetsEntry(s ChainSpec) string {
	var sb strings.Builder
	fmt.Fprintf(&sb, "    %q: {\n        \"AssetManager\": %q,\n", s.Key, s.AssetManager)
	if len(s.Assets) == 0 {
		sb.WriteString("        \"Assets\": {}\n    }")
		return sb.String()
	}
	sb.WriteString("        \"Assets\": {\n")
	for i, a := range s.Assets {
		sep := ","
		if i == len(s.Assets)-1 {
			sep = ""
		}
		fmt.Fprintf(&sb, "            %q: {\n                \"name\": %q,\n                \"decimals\": %d\n            }%s\n", a.Address, a.Symbol, a.Decimals, sep)
	}
	sb.WriteString("        }\n    }")
	return sb.String()
}

func todos(s ChainSpec) []string {
	t := []string{
		fmt.Sprintf("Add %s=%s to the DEPLOYED indexer env (.env / .env.mainnet / .env.testnet). requireEnv() throws at module load — a missing var stops the whole indexer, not just this chain.", s.EnvVar(), orPlaceholder(s.RPCURL)),
		"Confirm the relayer emits this chain to SCANNER_URL — the indexer is stream-driven, nothing appears until the relayer indexes it.",
		fmt.Sprintf("Confirm %q is present in api.sodax.com/v1/be/config/relay/chain-id-map, otherwise enrichChainsFromApi() skips it and hub-side asset symbols/decimals stay unresolved.", s.Key),
		"Rebuild + restart: indexer (indexer/Makefile), then api + explorer container.",
	}
	if !s.EVM {
		t = append(t, fmt.Sprintf("Implement the TODOs in indexer/src/chains/%s/index.ts (fetchPayload + decodeAddress).", s.Key))
	}
	if s.LogoSource == "" {
		t = append(t, fmt.Sprintf("Add explorer/public/images/network-%s.png — lib/render.js hardcodes the .png path, so list rows show a broken image without it.", s.Key))
	}
	if s.CoingeckoID == "" {
		t = append(t, "No coingecko id given: the native asset has no USD price in the explorer (same as redbelly/bitcoin/aleo/hedera today).")
	}
	return t
}

func orPlaceholder(v string) string {
	if v == "" {
		return "<rpc-url>"
	}
	return v
}

func handlerScaffold(s ChainSpec) string {
	return fmt.Sprintf(`import axios from "axios";
import { ChainHandler } from "../../types/ChainHandler";
import { TxPayload } from "../../types";
import { bigintDivisionToDecimalString } from "../../utils";

export class %s implements ChainHandler {
    private rpcUrl: string;

    constructor(config: { rpcUrl: string }) {
        this.rpcUrl = config.rpcUrl;
    }

    // TODO: convert the relayer's address encoding into this chain's canonical
    // form. Return the input unchanged if the relayer already reports it
    // canonically (see chains/evm), or map the prefix (see chains/icon).
    decodeAddress(address: string): string {
        return address;
    }

    // TODO: fetch the transaction, locate the xcall Message event, and return
    // its payload plus the fee. Reference implementations:
    //   chains/evm    — eth_getTransactionReceipt + topic matching
    //   chains/icon   — icx_getTransactionResult + eventLogs scan
    //   chains/solana — payload not on chain, fetched from the relay
    async fetchPayload(txHash: string, _txConnSn: string): Promise<TxPayload> {
        const _response = (await axios.post(this.rpcUrl, {
            jsonrpc: "2.0",
            id: 1,
            method: "TODO_rpc_method",
            params: [txHash],
        })).data;

        const fee = 0n; // TODO: gas/steps * price
        return {
            txnFee: `+"`${bigintDivisionToDecimalString(fee, 18)} %s`"+`,
            payload: "0x", // TODO: the Message event payload
            blockNumber: 0, // TODO: the block height
        };
    }
}
`, s.HandlerClass(), s.NativeSymbol)
}

// apply writes the plan to disk. Called only after the review screen is
// confirmed; every change was already produced successfully in memory.
func apply(root string, p *plan) error {
	for _, c := range p.Changes {
		abs := filepath.Join(root, c.Path)
		if c.IsNew {
			if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
				return fmt.Errorf("%s: %w", c.Path, err)
			}
		}
		if err := os.WriteFile(abs, c.Updated, 0o644); err != nil {
			return fmt.Errorf("%s: %w", c.Path, err)
		}
	}
	return nil
}
