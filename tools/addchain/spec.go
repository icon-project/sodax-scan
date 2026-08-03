package main

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// Asset is one spoke-side token entry written to indexer/config.json.
type Asset struct {
	Address  string
	Symbol   string
	Decimals int
}

// ChainSpec is everything the wizard collects. One spec produces the full set
// of edits across indexer, api and explorer.
type ChainSpec struct {
	Key           string // canonical lowercase chain key, e.g. "hedera"
	NID           string
	DisplayName   string
	NativeSymbol  string
	EVM           bool
	MainnetTxURL  string
	TestnetTxURL  string
	RPCURL        string
	HashedPayload bool
	AssetManager  string
	Assets        []Asset
	CoingeckoID   string
	LogoSource    string
}

func (s ChainSpec) EnvVar() string   { return strings.ToUpper(s.Key) + "_URL" }
func (s ChainSpec) UpperKey() string { return strings.ToUpper(s.Key) }

// HandlerClass is the class name of a hand-written non-EVM handler, matching
// the existing convention (icon -> IconHandler).
func (s ChainSpec) HandlerClass() string {
	if s.Key == "" {
		return "Handler"
	}
	return strings.ToUpper(s.Key[:1]) + s.Key[1:] + "Handler"
}

var (
	keyRe = regexp.MustCompile(`^[a-z][a-z0-9_]*$`)
	nidRe = regexp.MustCompile(`^[0-9]+$`)
)

func validateKey(v string) error {
	if !keyRe.MatchString(v) {
		return fmt.Errorf("must be lowercase letters/digits/underscore, starting with a letter (e.g. hedera)")
	}
	return nil
}

func validateNID(v string) error {
	if !nidRe.MatchString(v) {
		return fmt.Errorf("must be a positive integer (e.g. 18501)")
	}
	return nil
}

func validateSymbol(v string) error {
	if v != strings.ToUpper(v) {
		return fmt.Errorf("native asset symbol is conventionally uppercase (e.g. HBAR)")
	}
	if strings.ContainsAny(v, " \t\"'") {
		return fmt.Errorf("no spaces or quotes")
	}
	return nil
}

func validateURLPrefix(v string) error {
	if !strings.HasPrefix(v, "http://") && !strings.HasPrefix(v, "https://") {
		return fmt.Errorf("must start with http:// or https://")
	}
	if strings.Contains(v, "'") {
		return fmt.Errorf("no single quotes (breaks the generated JS literal)")
	}
	if !strings.HasSuffix(v, "/") && !strings.Contains(v, "{txHash}") {
		return fmt.Errorf("must end with / (the tx hash is appended directly) or contain {txHash}")
	}
	return nil
}

func validateRPC(v string) error {
	if !strings.HasPrefix(v, "http://") && !strings.HasPrefix(v, "https://") {
		return fmt.Errorf("must start with http:// or https://")
	}
	return nil
}

func validateDecimals(v string) error {
	n, err := strconv.Atoi(v)
	if err != nil {
		return fmt.Errorf("must be a number")
	}
	if n < 0 || n > 36 {
		return fmt.Errorf("must be between 0 and 36")
	}
	return nil
}
