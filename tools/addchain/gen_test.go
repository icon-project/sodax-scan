package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Files the generator has to be able to patch. Copied out of the real checkout
// into a temp dir for every test, so the tests fail the moment an upstream
// refactor moves an anchor.
var targetFiles = []string{
	"api/configs/mainnet_deployment.json",
	"api/configs/testnet_deployment.json",
	"api/constants.js",
	"explorer/configs/mainnet_deployment.json",
	"explorer/configs/testnet_deployment.json",
	"explorer/lib/helper.js",
	"explorer/lib/fetch-data.js",
	"indexer/.env.example",
	"indexer/config.json",
	"indexer/src/configs.ts",
	"indexer/src/handler.ts",
	"indexer/src/utils.ts",
}

func sandbox(t *testing.T) string {
	t.Helper()
	repo, err := resolveRoot("../..")
	if err != nil {
		t.Fatalf("resolving repo root: %v", err)
	}
	dst := t.TempDir()
	for _, rel := range targetFiles {
		raw, err := os.ReadFile(filepath.Join(repo, rel))
		if err != nil {
			t.Fatalf("reading %s: %v", rel, err)
		}
		out := filepath.Join(dst, rel)
		if err := os.MkdirAll(filepath.Dir(out), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(out, raw, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.MkdirAll(filepath.Join(dst, "explorer/public/images"), 0o755); err != nil {
		t.Fatal(err)
	}
	return dst
}

func read(t *testing.T, root, rel string) string {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(root, rel))
	if err != nil {
		t.Fatalf("reading %s: %v", rel, err)
	}
	return string(raw)
}

func mustContain(t *testing.T, root, rel string, want ...string) {
	t.Helper()
	got := read(t, root, rel)
	for _, w := range want {
		if !strings.Contains(got, w) {
			t.Errorf("%s missing %q", rel, w)
		}
	}
}

const svgFixture = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="black"/></svg>`

func evmSpec() ChainSpec {
	return ChainSpec{
		Key:          "plasma",
		NID:          "9745",
		DisplayName:  "plasma",
		NativeSymbol: "XPL",
		EVM:          true,
		MainnetTxURL: "https://plasmascan.to/tx/",
		TestnetTxURL: "https://testnet.plasmascan.to/tx/",
		RPCURL:       "https://rpc.plasma.to",
		AssetManager: "0x1111111111111111111111111111111111111111",
		Assets: []Asset{
			{Address: "0x0000000000000000000000000000000000000000", Symbol: "XPL", Decimals: 18},
			{Address: "0x2222222222222222222222222222222222222222", Symbol: "USDT", Decimals: 6},
		},
		CoingeckoID: "plasma",
	}
}

func applyPlan(t *testing.T, root string, s ChainSpec) *plan {
	t.Helper()
	p := buildPlan(root, s)
	if len(p.Errors) > 0 {
		t.Fatalf("plan errors: %v", p.Errors)
	}
	if err := apply(root, p); err != nil {
		t.Fatalf("apply: %v", err)
	}
	return p
}

func TestEVMChainEndToEnd(t *testing.T) {
	root := sandbox(t)
	s := evmSpec()
	logo := filepath.Join(t.TempDir(), "plasma.svg")
	if err := os.WriteFile(logo, []byte(svgFixture), 0o644); err != nil {
		t.Fatal(err)
	}
	s.LogoSource = logo

	p := applyPlan(t, root, s)
	if len(p.Changes) != 13 {
		t.Errorf("expected 13 changes for an EVM chain with a logo, got %d", len(p.Changes))
		for _, c := range p.Changes {
			t.Logf("  %s", c.Path)
		}
	}

	for _, rel := range []string{
		"api/configs/mainnet_deployment.json",
		"api/configs/testnet_deployment.json",
		"explorer/configs/mainnet_deployment.json",
		"explorer/configs/testnet_deployment.json",
	} {
		var doc struct {
			Networks map[string]struct{ NID any } `json:"networks"`
		}
		if err := json.Unmarshal([]byte(read(t, root, rel)), &doc); err != nil {
			t.Fatalf("%s: invalid JSON after edit: %v", rel, err)
		}
		if _, ok := doc.Networks["plasma"]; !ok {
			t.Errorf("%s: plasma not registered", rel)
		}
	}

	mustContain(t, root, "indexer/src/configs.ts",
		`export const plasma = "9745"`,
		"  plasma: plasma,",
		`  [plasma]: requireEnv("PLASMA_URL"),`,
	)
	mustContain(t, root, "indexer/src/handler.ts",
		", plasma } from './configs.ts';",
		`    [plasma]: new EvmHandler({ rpcUrl: RPC_URLS[plasma], denom: "XPL" }),`,
	)
	// .env.example keeps the value blank — RPC URLs are per-deployment secrets.
	mustContain(t, root, "indexer/.env.example", "\nPLASMA_URL=\n")
	if strings.Contains(read(t, root, "indexer/.env.example"), "PLASMA_URL=https") {
		t.Error(".env.example must not carry the RPC URL")
	}

	var cfg map[string]struct {
		AssetManager string `json:"AssetManager"`
		Assets       map[string]struct {
			Name     string `json:"name"`
			Decimals int    `json:"decimals"`
		} `json:"Assets"`
	}
	if err := json.Unmarshal([]byte(read(t, root, "indexer/config.json")), &cfg); err != nil {
		t.Fatalf("indexer/config.json invalid after edit: %v", err)
	}
	entry, ok := cfg["plasma"]
	if !ok {
		t.Fatal("indexer/config.json: plasma missing")
	}
	if entry.AssetManager != s.AssetManager || len(entry.Assets) != 2 {
		t.Errorf("indexer/config.json: unexpected entry %+v", entry)
	}
	if got := entry.Assets["0x2222222222222222222222222222222222222222"]; got.Name != "USDT" || got.Decimals != 6 {
		t.Errorf("asset not written correctly: %+v", got)
	}

	mustContain(t, root, "api/constants.js",
		"    PLASMA: CONFIG_NETWORKS.plasma.nid,",
		"        [NETWORK.PLASMA]: USE_MAINNET ? 'https://plasmascan.to/tx/' : 'https://testnet.plasmascan.to/tx/',",
	)
	mustContain(t, root, "explorer/lib/helper.js",
		"    PLASMA: 'plasma',",
		"    [NETWORK.PLASMA]: CONFIG_NETWORKS.plasma.nid,",
		"    [CONFIG_NETWORKS.plasma.nid]: [NETWORK.PLASMA],",
		"        nativeAsset: 'XPL',",
		"logo: `/images/network-plasma.png`",
	)
	mustContain(t, root, "explorer/lib/fetch-data.js", ",plasma`")

	// Both logo files land, and the png is the size render.js expects.
	png := read(t, root, "explorer/public/images/network-plasma.png")
	if len(png) < 100 || !strings.HasPrefix(png, "\x89PNG") {
		t.Error("logo png missing or not a png")
	}
	mustContain(t, root, "explorer/public/images/network-plasma.svg", "<circle")

	// One reference per map (NETWORK_MAPPINGS, REV_NETWORK_MAPPINGS) plus the
	// NETWORK_DETAILS key and its `id:` — the NETWORK entry itself is the
	// definition, so four in total. A different count means an entry landed in
	// the wrong object.
	helper := read(t, root, "explorer/lib/helper.js")
	if n := strings.Count(helper, "NETWORK.PLASMA"); n != 4 {
		t.Errorf("expected 4 NETWORK.PLASMA references in helper.js, got %d", n)
	}
}

func TestNonEVMHashedPayload(t *testing.T) {
	root := sandbox(t)
	s := evmSpec()
	s.Key = "cardano"
	s.NID = "8888"
	s.DisplayName = "cardano"
	s.NativeSymbol = "ADA"
	s.EVM = false
	s.HashedPayload = true
	s.CoingeckoID = ""
	s.LogoSource = ""

	applyPlan(t, root, s)

	mustContain(t, root, "indexer/src/handler.ts",
		"import { CardanoHandler } from './chains/cardano/index.ts';",
		"    [cardano]: new CardanoHandler({ rpcUrl: RPC_URLS[cardano] }),",
	)
	mustContain(t, root, "indexer/src/utils.ts",
		", cardano } from \"./configs\"",
		"srcChainId === bitcoin || srcChainId === cardano;",
	)
	scaffold := read(t, root, "indexer/src/chains/cardano/index.ts")
	for _, want := range []string{
		"export class CardanoHandler implements ChainHandler",
		"async fetchPayload(txHash: string, _txConnSn: string): Promise<TxPayload>",
		"decodeAddress(address: string): string",
		"ADA",
		"TODO",
	} {
		if !strings.Contains(scaffold, want) {
			t.Errorf("scaffold missing %q", want)
		}
	}
	// No coingecko id and no logo -> those files are left alone, and the TODO
	// list has to say so.
	for _, c := range buildPlan(root, s).Changes {
		if strings.Contains(c.Path, "fetch-data.js") || strings.Contains(c.Path, "images") {
			t.Errorf("unexpected change to %s", c.Path)
		}
	}
	todoText := strings.Join(todos(s), " ")
	for _, want := range []string{"network-cardano.png", "coingecko", "CARDANO_URL", "chain-id-map"} {
		if !strings.Contains(todoText, want) {
			t.Errorf("todos missing mention of %q", want)
		}
	}
}

// Every ETH L2 shares the coingecko id "ethereum", which is already in the
// explorer's price list. That is a skip, not a failure — the whole plan must
// still be applicable.
func TestSharedCoingeckoIDIsSkippedNotFatal(t *testing.T) {
	root := sandbox(t)
	s := evmSpec()
	s.CoingeckoID = "ethereum"

	p := buildPlan(root, s)
	if len(p.Errors) > 0 {
		t.Fatalf("an already-listed coingecko id must not block the plan: %v", p.Errors)
	}
	if len(p.Skipped) != 1 || p.Skipped[0].Path != "explorer/lib/fetch-data.js" {
		t.Errorf("expected fetch-data.js to be reported as skipped, got %+v", p.Skipped)
	}
	for _, c := range p.Changes {
		if c.Path == "explorer/lib/fetch-data.js" {
			t.Error("fetch-data.js must not be rewritten when the id is already listed")
		}
	}
	if err := apply(root, p); err != nil {
		t.Fatalf("apply: %v", err)
	}
	// The list is untouched: still one "ethereum", no stray comma.
	if got := read(t, root, "explorer/lib/fetch-data.js"); strings.Count(got, "ethereum") != 1 {
		t.Errorf("price list was modified: %s", firstLine(got))
	}
}

// A new id that happens to be a substring of a listed one must still be added.
func TestSubstringCoingeckoIDIsStillAdded(t *testing.T) {
	root := sandbox(t)
	s := evmSpec()
	s.CoingeckoID = "sol" // "solana" is already in the list

	p := buildPlan(root, s)
	if len(p.Errors) > 0 {
		t.Fatalf("plan errors: %v", p.Errors)
	}
	if err := apply(root, p); err != nil {
		t.Fatal(err)
	}
	mustContain(t, root, "explorer/lib/fetch-data.js", ",sol`")
}

func firstLine(s string) string {
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		return s[:i]
	}
	return s
}

// The committed example is what people copy, so it has to stay loadable and
// produce a clean plan against the current tree.
func TestExampleSpecIsUsable(t *testing.T) {
	root := sandbox(t)

	m, err := modelFromSpecFile(root, "example-spec.json")
	if err != nil {
		t.Fatalf("example-spec.json: %v", err)
	}
	if len(m.plan.Errors) > 0 {
		t.Fatalf("example-spec.json produces a broken plan: %v", m.plan.Errors)
	}
	if m.spec.Key == "" || m.spec.NativeSymbol == "" || len(m.spec.Assets) == 0 {
		t.Errorf("example should demonstrate a filled-in spec, got %+v", m.spec)
	}
	if m.spec.LogoSource != "" {
		t.Error("example must not point at a logo path that only exists on one machine")
	}
	if err := apply(root, m.plan); err != nil {
		t.Fatalf("apply: %v", err)
	}
	mustContain(t, root, "indexer/src/configs.ts", `export const celo = "42220"`)
}

func TestRerunIsRejected(t *testing.T) {
	root := sandbox(t)
	s := evmSpec()
	applyPlan(t, root, s)

	// Second run against an already-patched tree must fail loudly rather than
	// duplicate entries.
	p := buildPlan(root, s)
	if len(p.Errors) == 0 {
		t.Fatal("expected errors when adding the same chain twice")
	}

	existing, err := loadExistingChains(root)
	if err != nil {
		t.Fatal(err)
	}
	if existing["plasma"] != "9745" {
		t.Errorf("loadExistingChains did not pick up the new chain: %v", existing["plasma"])
	}
	if existing["hedera"] != "18501" {
		t.Errorf("loadExistingChains lost an existing chain: %v", existing["hedera"])
	}
}

func TestMissingAnchorIsFatal(t *testing.T) {
	root := sandbox(t)
	// Simulate an upstream refactor that renames the map the tool patches.
	rel := "explorer/lib/helper.js"
	src := read(t, root, rel)
	src = strings.Replace(src, "const REV_NETWORK_MAPPINGS = {", "const REVERSE_MAPPINGS = {", 1)
	if err := os.WriteFile(filepath.Join(root, rel), []byte(src), 0o644); err != nil {
		t.Fatal(err)
	}

	p := buildPlan(root, evmSpec())
	if len(p.Errors) == 0 {
		t.Fatal("expected an anchor error")
	}
	for _, c := range p.Changes {
		if c.Path == rel {
			t.Error("helper.js must not be queued for writing when an anchor is missing")
		}
	}
}
