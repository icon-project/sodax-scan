package main

import (
	"os"
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

// The wizard is driven through Update directly rather than through a running
// tea.Program: same code path, no terminal plumbing, and a stuck wizard fails
// the assertion instead of hanging the suite.

var (
	enter      = tea.KeyMsg{Type: tea.KeyEnter}
	clearField = tea.KeyMsg{Type: tea.KeyCtrlU} // wipes the current input
)

func typ(s string) tea.Msg { return tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune(s)} }

func send(m *model, msgs ...tea.Msg) {
	for _, msg := range msgs {
		m.Update(msg)
		m.View() // exercise rendering at every stage
	}
}

func newTestModel(t *testing.T, root string) *model {
	t.Helper()
	existing, err := loadExistingChains(root)
	if err != nil {
		t.Fatal(err)
	}
	return newModel(root, existing)
}

func TestWizardHappyPath(t *testing.T) {
	root := sandbox(t)
	m := newTestModel(t, root)

	send(m,
		typ("plasma"), enter, // chain key
		typ("9745"), enter, // nid
		enter,             // display name — accept the default (the key)
		typ("XPL"), enter, // native symbol
		typ("y"),                              // EVM
		typ("https://plasmascan.to/tx/"), nil, // (nil is ignored; keeps the list readable)
		enter, // submit mainnet explorer
		enter, // testnet explorer — accept the default (mainnet)
		typ("https://rpc.plasma.to"), enter,
		typ("n"), // payload not hashed
		typ("0x1111111111111111111111111111111111111111"), enter, // AssetManager
		typ("0x2222222222222222222222222222222222222222"), enter, // asset address
		typ("USDT"), enter, // asset symbol
		typ("6"), enter, // asset decimals
		enter,                // blank address ends the asset loop
		typ("plasma"), enter, // coingecko id
		enter, // no logo
	)

	if m.stage != stageReview {
		t.Fatalf("expected the review stage, got %v (stuck on field %d: %s)", m.stage, m.idx, m.cur().label)
	}
	got := m.spec
	if got.Key != "plasma" || got.NID != "9745" || got.DisplayName != "plasma" || got.NativeSymbol != "XPL" {
		t.Errorf("unexpected spec: %+v", got)
	}
	if !got.EVM || got.HashedPayload {
		t.Errorf("bool fields wrong: EVM=%v hashed=%v", got.EVM, got.HashedPayload)
	}
	if got.TestnetTxURL != got.MainnetTxURL || got.MainnetTxURL != "https://plasmascan.to/tx/" {
		t.Errorf("explorer urls wrong: %q / %q", got.MainnetTxURL, got.TestnetTxURL)
	}
	if len(got.Assets) != 1 || got.Assets[0].Symbol != "USDT" || got.Assets[0].Decimals != 6 {
		t.Errorf("assets wrong: %+v", got.Assets)
	}
	if len(m.plan.Errors) > 0 {
		t.Fatalf("plan errors: %v", m.plan.Errors)
	}
	if len(m.plan.Changes) != 11 {
		t.Errorf("expected 11 changes (no logo), got %d", len(m.plan.Changes))
	}
	if view := m.View(); !strings.Contains(view, "11 files to change") {
		t.Errorf("review screen does not list the file count:\n%s", view)
	}

	// y confirms; the writing itself is main's job.
	send(m, typ("y"))
	if !m.applying || m.aborted {
		t.Errorf("confirm did not arm the apply (applying=%v aborted=%v)", m.applying, m.aborted)
	}
}

func TestWizardRejectsBadInput(t *testing.T) {
	root := sandbox(t)
	m := newTestModel(t, root)

	// hedera is already registered and 18501 is its nid — both must be refused
	// with the wizard staying put, so a typo can't slip through.
	send(m, typ("hedera"), enter)
	if m.idx != 0 || m.err == "" {
		t.Errorf("duplicate chain key was accepted (idx=%d err=%q)", m.idx, m.err)
	}
	send(m, typ("HEDERA"), enter)
	if m.idx != 0 {
		t.Error("uppercase chain key was accepted")
	}
	// A rejected value stays in the field so it can be corrected — clear it the
	// way a user would before typing the good one.
	send(m, clearField, typ("plasma"), enter)
	if m.idx != 1 {
		t.Fatalf("valid key not accepted (err=%q)", m.err)
	}

	send(m, clearField, typ("18501"), enter)
	if m.idx != 1 || m.err == "" {
		t.Errorf("nid collision was accepted (err=%q)", m.err)
	}
	send(m, clearField, typ("nine"), enter)
	if m.idx != 1 {
		t.Error("non-numeric nid was accepted")
	}
	send(m, clearField, typ("9745"), enter)
	if m.idx != 2 {
		t.Fatalf("valid nid not accepted (err=%q)", m.err)
	}

	send(m, enter, typ("XPL"), enter, typ("y")) // name, symbol, EVM
	send(m, typ("ftp://nope"), enter)
	if m.err == "" {
		t.Error("non-http explorer url was accepted")
	}
	send(m, clearField, typ("https://plasmascan.to/tx"), enter)
	if m.err == "" {
		t.Error("explorer url without a trailing slash was accepted")
	}
	if m.spec.MainnetTxURL != "" {
		t.Errorf("rejected url leaked into the spec: %q", m.spec.MainnetTxURL)
	}
}

func TestWizardBackNavigation(t *testing.T) {
	root := sandbox(t)
	m := newTestModel(t, root)

	send(m,
		typ("plasma"), enter,
		typ("9745"), enter,
		tea.KeyMsg{Type: tea.KeyShiftTab}, // back to the nid
	)
	if m.idx != 1 {
		t.Fatalf("shift+tab did not go back (idx=%d)", m.idx)
	}
	if got := m.input.Value(); got != "9745" {
		t.Errorf("going back should pre-fill the previous answer, got %q", got)
	}
	send(m, clearField, typ("9746"), enter)
	if m.spec.NID != "9746" {
		t.Errorf("corrected nid not taken: %q", m.spec.NID)
	}

	send(m, enter, typ("XPL"), enter) // name, symbol -> EVM question
	send(m, typ("n"))                 // answer no, which advances
	if m.spec.EVM {
		t.Fatal("EVM=no not recorded")
	}
	send(m, tea.KeyMsg{Type: tea.KeyShiftTab}, typ("y"))
	if !m.spec.EVM {
		t.Error("re-answering the EVM question did not stick")
	}
}

func TestResumeOffersSavedAnswers(t *testing.T) {
	root := sandbox(t)
	want := evmSpec()
	if err := saveSpec(root, want); err != nil {
		t.Fatal(err)
	}

	// j: straight to the review with the saved answers.
	m := newTestModel(t, root)
	if m.stage != stageResume {
		t.Fatalf("saved answers should open the resume screen, stage=%v", m.stage)
	}
	if view := m.View(); !strings.Contains(view, "previous run") || !strings.Contains(view, "plasma") {
		t.Errorf("resume screen does not show the saved answers:\n%s", view)
	}
	send(m, typ("j"))
	if m.stage != stageReview {
		t.Fatalf("j should jump to the review, stage=%v", m.stage)
	}
	if m.spec.Key != want.Key || m.spec.NID != want.NID || len(m.spec.Assets) != len(want.Assets) {
		t.Errorf("saved answers not restored: %+v", m.spec)
	}
	if len(m.plan.Errors) > 0 {
		t.Errorf("resumed plan has errors: %v", m.plan.Errors)
	}

	// r: step through the wizard with each answer pre-filled.
	m = newTestModel(t, root)
	send(m, typ("r"))
	if m.stage != stageForm || m.idx != 0 {
		t.Fatalf("r should re-enter the form at step 1 (stage=%v idx=%d)", m.stage, m.idx)
	}
	if got := m.input.Value(); got != want.Key {
		t.Errorf("first field should be pre-filled with %q, got %q", want.Key, got)
	}
	send(m, enter)
	if m.idx != 1 || m.spec.Key != want.Key {
		t.Errorf("pre-filled answer not accepted on enter (idx=%d key=%q)", m.idx, m.spec.Key)
	}

	// n: discard and start clean.
	m = newTestModel(t, root)
	send(m, typ("n"))
	if m.stage != stageForm || m.spec.Key != "" || len(m.spec.Assets) != 0 {
		t.Errorf("n should start fresh, got stage=%v spec=%+v", m.stage, m.spec)
	}
	if !m.spec.EVM {
		t.Error("a fresh spec should still default to EVM")
	}
}

func TestSavedSpecRoundTripAndTolerance(t *testing.T) {
	root := sandbox(t)
	if got := loadSavedSpec(root); got != nil {
		t.Errorf("no saved file should mean no offer, got %+v", got)
	}

	want := evmSpec()
	want.HashedPayload = true
	if err := saveSpec(root, want); err != nil {
		t.Fatal(err)
	}
	got := loadSavedSpec(root)
	if got == nil {
		t.Fatal("saved spec not loaded back")
	}
	if got.Key != want.Key || !got.HashedPayload || got.Assets[1].Decimals != 6 || got.CoingeckoID != want.CoingeckoID {
		t.Errorf("round trip lost data: %+v", got)
	}

	// A truncated or hand-mangled scratch file must be ignored, not fatal.
	if err := os.WriteFile(savedSpecPath(root), []byte(`{"Key": "plas`), 0o644); err != nil {
		t.Fatal(err)
	}
	if got := loadSavedSpec(root); got != nil {
		t.Errorf("corrupt saved spec should be ignored, got %+v", got)
	}
	m := newTestModel(t, root)
	if m.stage != stageForm {
		t.Errorf("corrupt saved spec should go straight to the form, stage=%v", m.stage)
	}
}

func TestWizardAssetLoopValidation(t *testing.T) {
	root := sandbox(t)
	m := newTestModel(t, root)

	send(m,
		typ("plasma"), enter, typ("9745"), enter, enter, typ("XPL"), enter, typ("y"),
		typ("https://plasmascan.to/tx/"), enter, enter, enter, typ("n"), enter,
	)
	if m.cur().kind != kAssets {
		t.Fatalf("expected the asset loop, got field %q", m.cur().label)
	}

	send(m, typ("0xabc"), enter, typ("USDC"), enter, typ("six"), enter)
	if m.err == "" || len(m.spec.Assets) != 0 {
		t.Errorf("non-numeric decimals accepted (err=%q assets=%+v)", m.err, m.spec.Assets)
	}
	send(m, clearField, typ("6"), enter)
	if len(m.spec.Assets) != 1 {
		t.Fatalf("asset not recorded: %+v", m.spec.Assets)
	}
	// Second asset, then a blank address to finish.
	send(m, typ("0xdef"), enter, typ("WETH"), enter, typ("18"), enter, enter)
	if len(m.spec.Assets) != 2 {
		t.Errorf("expected 2 assets, got %+v", m.spec.Assets)
	}
	if m.cur().label != "Coingecko id" {
		t.Errorf("blank address should end the loop and move on, got field %q", m.cur().label)
	}
}
