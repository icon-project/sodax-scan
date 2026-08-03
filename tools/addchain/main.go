package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
)

func main() {
	repoFlag := flag.String("repo", "", "path to the sodax-scan checkout (default: auto-detect from cwd)")
	specFlag := flag.String("spec", "", "JSON file of answers — skips the wizard (shape: tools/addchain/example-spec.json)")
	flag.Parse()

	root, err := resolveRoot(*repoFlag)
	if err != nil {
		fatal(err)
	}
	existing, err := loadExistingChains(root)
	if err != nil {
		fatal(fmt.Errorf("reading existing chains: %w", err))
	}

	var m *model
	if *specFlag != "" {
		m, err = modelFromSpecFile(root, *specFlag)
		if err != nil {
			fatal(err)
		}
	} else {
		final, err := tea.NewProgram(newModel(root, existing)).Run()
		if err != nil {
			fatal(err)
		}
		m = final.(*model)
	}
	if m.aborted || !m.applying {
		fmt.Println(errStyle.Render("aborted — nothing written"))
		os.Exit(1)
	}
	if len(m.plan.Errors) > 0 {
		for _, e := range m.plan.Errors {
			fmt.Fprintln(os.Stderr, errStyle.Render("✗ "+e))
		}
		fatal(fmt.Errorf("plan has blocking errors — nothing written"))
	}

	if err := apply(root, m.plan); err != nil {
		fatal(fmt.Errorf("writing changes: %w", err))
	}

	fmt.Println(okStyle.Render(fmt.Sprintf("✓ %s added — %d files written", m.spec.Key, len(m.plan.Changes))))
	for _, c := range m.plan.Changes {
		tag := "edit"
		if c.IsNew {
			tag = " new"
		}
		fmt.Printf("  %s %s\n", stepStyle.Render(tag), pathStyle.Render(c.Path))
	}
	for _, c := range m.plan.Skipped {
		fmt.Printf("  %s %s  %s\n", stepStyle.Render("skip"), pathStyle.Render(c.Path), helpStyle.Render(c.Note))
	}
	printTodos(m.plan)

	fmt.Println("\n" + labelStyle.Render("git diff --stat"))
	out, err := exec.Command("git", "-C", root, "diff", "--stat").CombinedOutput()
	if err != nil {
		fmt.Println(helpStyle.Render("(git diff failed: " + err.Error() + ")"))
	}
	fmt.Println(strings.TrimRight(string(out), "\n"))
	fmt.Println(footStyle.Render("nothing is staged — review, then commit or `git checkout --` to undo"))
}

func printTodos(p *plan) {
	if len(p.Todos) == 0 {
		return
	}
	fmt.Println("\n" + labelStyle.Render("still on you:"))
	for i, t := range p.Todos {
		fmt.Printf("  %d. %s\n", i+1, t)
	}
}

// modelFromSpecFile builds the same state the wizard would have produced, for
// non-interactive re-runs (a second checkout, or replaying a chain add).
func modelFromSpecFile(root, path string) (*model, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var s ChainSpec
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil, fmt.Errorf("%s: %w", path, err)
	}
	if s.Key == "" || s.NID == "" {
		return nil, fmt.Errorf("%s: Key and NID are required", path)
	}
	if s.DisplayName == "" {
		s.DisplayName = s.Key
	}
	if s.TestnetTxURL == "" {
		s.TestnetTxURL = s.MainnetTxURL
	}
	return &model{root: root, spec: s, plan: buildPlan(root, s), applying: true}, nil
}

// resolveRoot finds the repo root by walking up until the indexer's chain
// registry is in sight — the one file every run has to touch.
func resolveRoot(explicit string) (string, error) {
	start := explicit
	if start == "" {
		wd, err := os.Getwd()
		if err != nil {
			return "", err
		}
		start = wd
	}
	abs, err := filepath.Abs(start)
	if err != nil {
		return "", err
	}
	for dir := abs; ; {
		if _, err := os.Stat(filepath.Join(dir, "indexer/src/configs.ts")); err == nil {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("not inside a sodax-scan checkout (no indexer/src/configs.ts above %s) — pass -repo", abs)
		}
		dir = parent
	}
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, errStyle.Render("✗ "+err.Error()))
	os.Exit(1)
}
