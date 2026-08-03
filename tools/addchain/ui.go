package main

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// Palette lifted from the explorer's tailwind config so the tool feels like the
// thing it edits.
var (
	cherry   = lipgloss.Color("#A55C55")
	sodaGold = lipgloss.Color("#ECC100")
	clay     = lipgloss.Color("#8E7E7D")
	cream    = lipgloss.Color("#EDE7E7")
	danger   = lipgloss.Color("#C36C65")
	ok       = lipgloss.Color("#7BA05B")

	titleStyle = lipgloss.NewStyle().Bold(true).Foreground(cream).Background(cherry).Padding(0, 1)
	stepStyle  = lipgloss.NewStyle().Foreground(clay)
	labelStyle = lipgloss.NewStyle().Bold(true).Foreground(sodaGold)
	helpStyle  = lipgloss.NewStyle().Foreground(clay).Italic(true)
	errStyle   = lipgloss.NewStyle().Foreground(danger).Bold(true)
	okStyle    = lipgloss.NewStyle().Foreground(ok)
	footStyle  = lipgloss.NewStyle().Foreground(clay)
	valStyle   = lipgloss.NewStyle().Foreground(cream)
	pathStyle  = lipgloss.NewStyle().Foreground(sodaGold)
	boxStyle   = lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(cherry).Padding(0, 2)
)

type fieldKind int

const (
	kText fieldKind = iota
	kBool
	kAssets
)

type field struct {
	label       string
	help        string
	placeholder string
	kind        fieldKind
	optional    bool
	deflt       func(*ChainSpec) string
	set         func(*model, string) error
	show        func(*ChainSpec) string
}

type stage int

const (
	stageForm stage = iota
	stageReview
	stageDone
	stageResume
)

type model struct {
	root     string
	existing map[string]string
	fields   []field
	idx      int
	input    textinput.Model
	spec     ChainSpec
	err      string
	stage    stage

	// asset sub-flow state
	assetField int // 0 address, 1 symbol, 2 decimals
	assetDraft Asset

	saved *ChainSpec // answers from a previous run, offered on the resume screen

	plan     *plan
	applying bool // set when the user confirmed; main does the writing
	aborted  bool
	width    int
}

func newModel(root string, existing map[string]string) *model {
	ti := textinput.New()
	ti.Prompt = "› "
	ti.PromptStyle = lipgloss.NewStyle().Foreground(cherry)
	ti.CharLimit = 200
	ti.Focus()

	m := &model{root: root, existing: existing, input: ti, spec: ChainSpec{EVM: true}}
	m.fields = buildFields()
	// A previous run's answers are offered, never silently adopted — the tree may
	// have moved on since, and a stale nid pasted in without asking is worse than
	// retyping one.
	if saved := loadSavedSpec(root); saved != nil {
		m.saved = saved
		m.stage = stageResume
	}
	m.primeInput()
	return m
}

func buildFields() []field {
	return []field{
		{
			label:       "Chain key",
			help:        "canonical lowercase id, used as the object key in every config (e.g. hedera)",
			placeholder: "hedera",
			set: func(m *model, v string) error {
				if err := validateKey(v); err != nil {
					return err
				}
				if nid, dup := m.existing[v]; dup {
					return fmt.Errorf("%q already exists in indexer/src/configs.ts (nid %s)", v, nid)
				}
				m.spec.Key = v
				return nil
			},
			show: func(s *ChainSpec) string { return s.Key },
		},
		{
			label:       "Network id (nid)",
			help:        "the relayer's numeric chain id — goes into all four deployment configs",
			placeholder: "18501",
			set: func(m *model, v string) error {
				if err := validateNID(v); err != nil {
					return err
				}
				for k, nid := range m.existing {
					if nid == v {
						return fmt.Errorf("nid %s is already used by %q", v, k)
					}
				}
				m.spec.NID = v
				return nil
			},
			show: func(s *ChainSpec) string { return s.NID },
		},
		{
			label: "Display name",
			help:  "shown in the explorer network filter and row tooltips",
			deflt: func(s *ChainSpec) string { return s.Key },
			set: func(m *model, v string) error {
				if strings.ContainsAny(v, "'\"") {
					return fmt.Errorf("no quotes")
				}
				m.spec.DisplayName = v
				return nil
			},
			show: func(s *ChainSpec) string { return s.DisplayName },
		},
		{
			label:       "Native asset symbol",
			help:        "explorer NETWORK_DETAILS.nativeAsset and the EVM handler's fee denom",
			placeholder: "HBAR",
			set: func(m *model, v string) error {
				if err := validateSymbol(v); err != nil {
					return err
				}
				m.spec.NativeSymbol = v
				return nil
			},
			show: func(s *ChainSpec) string { return s.NativeSymbol },
		},
		{
			label: "EVM compatible?",
			help:  "yes reuses EvmHandler; no scaffolds indexer/src/chains/<key>/index.ts for you to fill in",
			kind:  kBool,
			set: func(m *model, v string) error {
				m.spec.EVM = v == "yes"
				return nil
			},
			show: func(s *ChainSpec) string { return yesNo(s.EVM) },
		},
		{
			label:       "Mainnet tx explorer prefix",
			help:        "api/constants.js META_URLS.tx — the tx hash is appended verbatim, so end with /",
			placeholder: "https://hashscan.io/mainnet/transaction/",
			set: func(m *model, v string) error {
				if err := validateURLPrefix(v); err != nil {
					return err
				}
				m.spec.MainnetTxURL = v
				return nil
			},
			show: func(s *ChainSpec) string { return s.MainnetTxURL },
		},
		{
			label: "Testnet tx explorer prefix",
			help:  "same as mainnet is fine — several chains do exactly that",
			deflt: func(s *ChainSpec) string { return s.MainnetTxURL },
			set: func(m *model, v string) error {
				if err := validateURLPrefix(v); err != nil {
					return err
				}
				m.spec.TestnetTxURL = v
				return nil
			},
			show: func(s *ChainSpec) string { return s.TestnetTxURL },
		},
		{
			label:       "RPC URL",
			help:        "NOT committed — .env.example gets a blank line; this is echoed in the TODO list for your deployed .env",
			placeholder: "https://... (optional, enter to skip)",
			optional:    true,
			set: func(m *model, v string) error {
				if v == "" {
					m.spec.RPCURL = ""
					return nil
				}
				if err := validateRPC(v); err != nil {
					return err
				}
				m.spec.RPCURL = v
				return nil
			},
			show: func(s *ChainSpec) string { return orNone(s.RPCURL) },
		},
		{
			label: "Payload hashed / relay-fetched?",
			help:  "yes for chains that don't carry the payload on-chain (solana, bitcoin) — flips srcHasHashedPayload",
			kind:  kBool,
			set: func(m *model, v string) error {
				m.spec.HashedPayload = v == "yes"
				return nil
			},
			show: func(s *ChainSpec) string { return yesNo(s.HashedPayload) },
		},
		{
			label:       "AssetManager address",
			help:        "indexer/config.json — leave blank if not deployed yet (aleo ships blank)",
			placeholder: "0x... (optional, enter to skip)",
			optional:    true,
			set: func(m *model, v string) error {
				m.spec.AssetManager = v
				return nil
			},
			show: func(s *ChainSpec) string { return orNone(s.AssetManager) },
		},
		{
			label: "Assets",
			help:  "spoke-side tokens for indexer/config.json — hub-side reps are added at runtime by enrichChainsFromApi()",
			kind:  kAssets,
			show:  func(s *ChainSpec) string { return fmt.Sprintf("%d entered", len(s.Assets)) },
		},
		{
			label:       "Coingecko id",
			help:        "explorer/lib/fetch-data.js price lookup for the native asset — blank means no USD price",
			placeholder: "hedera-hashgraph (optional, enter to skip)",
			optional:    true,
			set: func(m *model, v string) error {
				if strings.ContainsAny(v, " `,") {
					return fmt.Errorf("single id, no spaces/commas")
				}
				m.spec.CoingeckoID = v
				return nil
			},
			show: func(s *ChainSpec) string { return orNone(s.CoingeckoID) },
		},
		{
			label:       "Logo (path or URL)",
			help:        "svg/png/jpg — converted to a 360x360 network-<key>.png (svg source is kept alongside)",
			placeholder: "~/Downloads/hedera.svg (optional, enter to skip)",
			optional:    true,
			set: func(m *model, v string) error {
				m.spec.LogoSource = v
				return nil
			},
			show: func(s *ChainSpec) string { return orNone(s.LogoSource) },
		},
	}
}

func (m *model) cur() field { return m.fields[m.idx] }

// primeInput resets the text input for the current field, pre-filling the
// default (or a previously entered value when navigating back).
func (m *model) primeInput() {
	f := m.cur()
	m.input.Placeholder = f.placeholder
	m.input.SetValue("")
	if f.kind == kText {
		if prev := f.show(&m.spec); prev != "" && prev != "—" {
			m.input.SetValue(prev)
		} else if f.deflt != nil {
			m.input.SetValue(f.deflt(&m.spec))
		}
		m.input.CursorEnd()
	}
	if f.kind == kAssets {
		m.assetField = 0
		m.assetDraft = Asset{}
		m.input.SetValue("")
		m.input.Placeholder = "0x... (enter to finish)"
	}
}

func (m *model) next() {
	if m.idx == len(m.fields)-1 {
		m.plan = buildPlan(m.root, m.spec)
		m.stage = stageReview
		return
	}
	m.idx++
	m.err = ""
	m.primeInput()
}

func (m *model) prev() {
	if m.idx == 0 {
		return
	}
	m.idx--
	m.err = ""
	m.primeInput()
}

func (m *model) Init() tea.Cmd { return textinput.Blink }

func (m *model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		return m, nil
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c":
			m.aborted = true
			return m, tea.Quit
		}
		switch m.stage {
		case stageResume:
			return m.updateResume(msg)
		case stageReview:
			return m.updateReview(msg)
		}
		return m.updateForm(msg)
	}
	var cmd tea.Cmd
	m.input, cmd = m.input.Update(msg)
	return m, cmd
}

func (m *model) updateResume(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "r", "enter": // walk the wizard with every answer pre-filled
		m.spec = *m.saved
		m.stage = stageForm
		m.idx = 0
		m.primeInput()
	case "j": // straight to the review screen
		m.spec = *m.saved
		m.plan = buildPlan(m.root, m.spec)
		m.stage = stageReview
	case "n": // start over
		m.stage = stageForm
		m.idx = 0
		m.primeInput()
	case "q", "esc":
		m.aborted = true
		return m, tea.Quit
	}
	return m, nil
}

func (m *model) updateReview(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {
	case "y", "enter":
		if len(m.plan.Errors) > 0 {
			m.err = "fix the blocking errors first (e = back to the wizard, q = quit)"
			return m, nil
		}
		m.applying = true
		m.stage = stageDone
		return m, tea.Quit
	case "e":
		m.stage = stageForm
		m.idx = 0
		m.err = ""
		m.primeInput()
		return m, nil
	case "q", "esc":
		m.aborted = true
		return m, tea.Quit
	}
	return m, nil
}

func (m *model) updateForm(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	f := m.cur()

	switch msg.String() {
	case "shift+tab", "ctrl+p":
		m.prev()
		return m, nil
	case "esc":
		m.aborted = true
		return m, tea.Quit
	}

	if f.kind == kBool {
		switch msg.String() {
		case "y", "Y":
			_ = f.set(m, "yes")
			m.next()
		case "n", "N":
			_ = f.set(m, "no")
			m.next()
		case "left", "right", "tab", " ":
			cur := f.show(&m.spec) == "yes"
			_ = f.set(m, yesNo(!cur))
		case "enter":
			m.next()
		}
		return m, nil
	}

	if f.kind == kAssets {
		return m.updateAssets(msg)
	}

	if msg.String() == "enter" {
		v := strings.TrimSpace(m.input.Value())
		if v == "" && !f.optional {
			m.err = "required"
			return m, nil
		}
		if err := f.set(m, v); err != nil {
			m.err = err.Error()
			return m, nil
		}
		m.next()
		return m, nil
	}

	var cmd tea.Cmd
	m.input, cmd = m.input.Update(msg)
	return m, cmd
}

func (m *model) updateAssets(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	if msg.String() != "enter" {
		var cmd tea.Cmd
		m.input, cmd = m.input.Update(msg)
		return m, cmd
	}
	v := strings.TrimSpace(m.input.Value())

	switch m.assetField {
	case 0: // address — blank means "done adding assets"
		if v == "" {
			m.next()
			return m, nil
		}
		m.assetDraft = Asset{Address: v}
		m.assetField = 1
		m.input.SetValue("")
		m.input.Placeholder = "symbol, e.g. HBAR"
	case 1:
		if v == "" {
			m.err = "symbol required"
			return m, nil
		}
		m.assetDraft.Symbol = v
		m.assetField = 2
		m.input.SetValue("")
		m.input.Placeholder = "decimals, e.g. 8"
	case 2:
		if err := validateDecimals(v); err != nil {
			m.err = err.Error()
			return m, nil
		}
		n, _ := strconv.Atoi(v)
		m.assetDraft.Decimals = n
		m.spec.Assets = append(m.spec.Assets, m.assetDraft)
		m.assetDraft = Asset{}
		m.assetField = 0
		m.input.SetValue("")
		m.input.Placeholder = "0x... (enter to finish)"
	}
	m.err = ""
	return m, nil
}

func (m *model) View() string {
	var b strings.Builder
	b.WriteString(titleStyle.Render(" sodax-scan · add chain "))
	b.WriteString("\n\n")

	switch m.stage {
	case stageResume:
		b.WriteString(m.resumeView())
	case stageReview:
		b.WriteString(m.reviewView())
	case stageDone:
		b.WriteString(okStyle.Render("applying…") + "\n")
	default:
		b.WriteString(m.formView())
	}
	return b.String()
}

func (m *model) resumeView() string {
	var b strings.Builder
	s := m.saved

	b.WriteString(labelStyle.Render("answers from a previous run") + "\n")
	b.WriteString(helpStyle.Render(savedSpecRel) + "\n\n")

	var sum strings.Builder
	for _, f := range m.fields {
		sum.WriteString(fmt.Sprintf("%-34s %s\n", stepStyle.Render(f.label), valStyle.Render(f.show(s))))
	}
	b.WriteString(boxStyle.Render(strings.TrimRight(sum.String(), "\n")) + "\n")

	if nid, dup := m.existing[s.Key]; dup {
		b.WriteString("\n" + errStyle.Render(fmt.Sprintf("note: %q has since been added to this tree (nid %s) — these answers are spent", s.Key, nid)) + "\n")
	}
	b.WriteString("\n" + footStyle.Render("r reuse and step through · j jump to the review · n start fresh · q quit") + "\n")
	return b.String()
}

func (m *model) formView() string {
	f := m.cur()
	var b strings.Builder

	b.WriteString(stepStyle.Render(fmt.Sprintf("step %d/%d", m.idx+1, len(m.fields))) + "\n")
	b.WriteString(labelStyle.Render(f.label) + "\n")
	b.WriteString(helpStyle.Render(f.help) + "\n\n")

	switch f.kind {
	case kBool:
		cur := f.show(&m.spec) == "yes"
		yes, no := "  yes  ", "  no  "
		sel := lipgloss.NewStyle().Bold(true).Foreground(cream).Background(cherry)
		unsel := lipgloss.NewStyle().Foreground(clay)
		if cur {
			b.WriteString(sel.Render(yes) + unsel.Render(no))
		} else {
			b.WriteString(unsel.Render(yes) + sel.Render(no))
		}
		b.WriteString("\n")
	case kAssets:
		for i, a := range m.spec.Assets {
			b.WriteString(okStyle.Render(fmt.Sprintf("  %d. %s  %s (%d decimals)", i+1, a.Address, a.Symbol, a.Decimals)) + "\n")
		}
		if len(m.spec.Assets) > 0 {
			b.WriteString("\n")
		}
		switch m.assetField {
		case 0:
			b.WriteString(stepStyle.Render("asset address (blank = done)") + "\n")
		case 1:
			b.WriteString(stepStyle.Render("symbol for "+m.assetDraft.Address) + "\n")
		case 2:
			b.WriteString(stepStyle.Render("decimals for "+m.assetDraft.Symbol) + "\n")
		}
		b.WriteString(m.input.View() + "\n")
	default:
		b.WriteString(m.input.View() + "\n")
	}

	if m.err != "" {
		b.WriteString("\n" + errStyle.Render("✗ "+m.err) + "\n")
	}
	b.WriteString("\n" + footStyle.Render("enter next · shift+tab back · esc abort") + "\n")
	return b.String()
}

func (m *model) reviewView() string {
	var b strings.Builder
	s := m.spec

	var sum strings.Builder
	for _, f := range m.fields {
		sum.WriteString(fmt.Sprintf("%-34s %s\n",
			stepStyle.Render(f.label), valStyle.Render(f.show(&s))))
	}
	b.WriteString(boxStyle.Render(strings.TrimRight(sum.String(), "\n")) + "\n\n")

	b.WriteString(labelStyle.Render(fmt.Sprintf("%d files to change", len(m.plan.Changes))) + "\n")
	for _, c := range m.plan.Changes {
		tag := "edit"
		if c.IsNew {
			tag = " new"
		}
		b.WriteString(fmt.Sprintf("  %s %s  %s\n", stepStyle.Render(tag), pathStyle.Render(c.Path), helpStyle.Render(c.Note)))
	}

	if len(m.plan.Skipped) > 0 {
		b.WriteString("\n" + stepStyle.Render("nothing to do:") + "\n")
		for _, c := range m.plan.Skipped {
			b.WriteString(fmt.Sprintf("  %s %s  %s\n", stepStyle.Render("skip"), pathStyle.Render(c.Path), helpStyle.Render(c.Note)))
		}
	}

	if len(m.plan.Errors) > 0 {
		b.WriteString("\n" + errStyle.Render("blocking errors — nothing will be written:") + "\n")
		for _, e := range m.plan.Errors {
			b.WriteString(errStyle.Render("  ✗ "+e) + "\n")
		}
	}
	if m.err != "" {
		b.WriteString("\n" + errStyle.Render("✗ "+m.err) + "\n")
	}
	b.WriteString("\n" + footStyle.Render("y apply · e edit answers · q abort") + "\n")
	return b.String()
}

func yesNo(b bool) string {
	if b {
		return "yes"
	}
	return "no"
}

func orNone(v string) string {
	if v == "" {
		return "—"
	}
	return v
}
