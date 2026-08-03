package main

import (
	"fmt"
	"strings"
)

// This file holds the text-surgery primitives. Every mutation is anchored on
// structure that already exists in the target file (an object literal header, an
// import list, a known line) and fails loudly when the anchor is gone, so a
// refactor upstream can never turn into a silently mangled file.

// skipString returns the index of the closing quote of the string literal that
// starts at `start`.
func skipString(src string, start int) (int, error) {
	q := src[start]
	for i := start + 1; i < len(src); i++ {
		switch src[i] {
		case '\\':
			i++
		case q:
			return i, nil
		case '\n':
			if q != '`' {
				return 0, fmt.Errorf("unterminated string at offset %d", start)
			}
		}
	}
	return 0, fmt.Errorf("unterminated string at offset %d", start)
}

// matchBrace finds the '}' closing the '{' at `open`, ignoring braces that live
// inside string literals or comments.
func matchBrace(src string, open int) (int, error) {
	if open >= len(src) || src[open] != '{' {
		return 0, fmt.Errorf("expected '{' at offset %d", open)
	}
	depth := 0
	for i := open; i < len(src); i++ {
		switch src[i] {
		case '"', '\'', '`':
			j, err := skipString(src, i)
			if err != nil {
				return 0, err
			}
			i = j
		case '/':
			if i+1 < len(src) && src[i+1] == '/' {
				n := strings.IndexByte(src[i:], '\n')
				if n < 0 {
					return 0, fmt.Errorf("unterminated line comment at offset %d", i)
				}
				i += n
			} else if i+1 < len(src) && src[i+1] == '*' {
				n := strings.Index(src[i+2:], "*/")
				if n < 0 {
					return 0, fmt.Errorf("unterminated block comment at offset %d", i)
				}
				i += 2 + n + 1
			}
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return i, nil
			}
		}
	}
	return 0, fmt.Errorf("unbalanced braces from offset %d", open)
}

// findBlock locates an object literal by its header (which must end in '{') and
// returns the offsets of its opening and closing brace. Several header spellings
// may be passed; the first one present wins.
func findBlock(src string, headers ...string) (open, close int, err error) {
	return findBlockAfter(src, 0, headers...)
}

func findBlockAfter(src string, from int, headers ...string) (open, close int, err error) {
	for _, h := range headers {
		idx := strings.Index(src[from:], h)
		if idx < 0 {
			continue
		}
		open = from + idx + len(h) - 1
		if src[open] != '{' {
			return 0, 0, fmt.Errorf("anchor %q must end with '{'", h)
		}
		close, err = matchBrace(src, open)
		if err != nil {
			return 0, 0, fmt.Errorf("anchor %q: %w", h, err)
		}
		return open, close, nil
	}
	return 0, 0, fmt.Errorf("anchor not found: %q", headers[0])
}

// appendToBlock inserts `entry` as the last member of the object literal opened
// at `open`, adding a trailing comma to the previous member when it lacks one.
func appendToBlock(src string, open int, entry string) (string, error) {
	closeIdx, err := matchBrace(src, open)
	if err != nil {
		return "", err
	}
	lineStart := strings.LastIndexByte(src[:closeIdx], '\n')
	if lineStart < 0 {
		return "", fmt.Errorf("object at offset %d is not multi-line; refusing to edit", open)
	}
	head, tail := src[:lineStart], src[lineStart:]
	trimmed := strings.TrimRight(head, " \t\r\n")
	if n := len(trimmed); n > 0 && trimmed[n-1] != ',' && trimmed[n-1] != '{' {
		head = trimmed + "," + head[n:]
	}
	return head + "\n" + entry + tail, nil
}

// appendEntry is the common case: find the block by header, append an entry.
func appendEntry(src, entry string, headers ...string) (string, error) {
	open, _, err := findBlock(src, headers...)
	if err != nil {
		return "", err
	}
	return appendToBlock(src, open, entry)
}

// appendNestedEntry appends to a block nested inside another (e.g. `tx: {`
// inside `const META_URLS = {`).
func appendNestedEntry(src, entry string, outer string, inner ...string) (string, error) {
	outerOpen, outerClose, err := findBlock(src, outer)
	if err != nil {
		return "", err
	}
	innerOpen, _, err := findBlockAfter(src[:outerClose], outerOpen, inner...)
	if err != nil {
		return "", err
	}
	return appendToBlock(src, innerOpen, entry)
}

// addToImportList widens an existing named-import list, e.g.
// `import { a, b } from './configs.ts'` -> `import { a, b, hedera } from ...`.
func addToImportList(src, fromClause, name string) (string, error) {
	idx := strings.Index(src, fromClause)
	if idx < 0 {
		return "", fmt.Errorf("import not found: %q", fromClause)
	}
	lineStart := strings.LastIndexByte(src[:idx], '\n') + 1
	brace := strings.LastIndexByte(src[lineStart:idx], '}')
	if brace < 0 {
		return "", fmt.Errorf("no named-import braces before %q", fromClause)
	}
	brace += lineStart
	if strings.Contains(src[lineStart:brace], name+",") || wordInList(src[lineStart:brace], name) {
		return src, nil // already imported
	}
	// Insert after the last name, keeping whatever whitespace sat before the
	// closing brace so the line's original spelling survives.
	cut := strings.TrimRight(src[lineStart:brace], " \t")
	ws := src[lineStart+len(cut) : brace]
	return src[:lineStart] + cut + ", " + name + ws + src[brace:], nil
}

func wordInList(list, name string) bool {
	for _, p := range strings.Split(strings.Trim(list, "{} \t"), ",") {
		if strings.TrimSpace(p) == name {
			return true
		}
	}
	return false
}

// insertAfterLastLineMatching inserts `line` directly after the last line for
// which `match` reports true.
func insertAfterLastLineMatching(src, line string, match func(string) bool) (string, error) {
	lines := strings.Split(src, "\n")
	last := -1
	for i, l := range lines {
		if match(l) {
			last = i
		}
	}
	if last < 0 {
		return "", fmt.Errorf("no anchor line found")
	}
	out := append([]string{}, lines[:last+1]...)
	out = append(out, line)
	out = append(out, lines[last+1:]...)
	return strings.Join(out, "\n"), nil
}

// insertBeforeLineMatching inserts `line` before the first matching line,
// skipping back over any blank lines so the new line joins the block above.
func insertBeforeLineMatching(src, line string, match func(string) bool) (string, error) {
	lines := strings.Split(src, "\n")
	at := -1
	for i, l := range lines {
		if match(l) {
			at = i
			break
		}
	}
	if at < 0 {
		return "", fmt.Errorf("no anchor line found")
	}
	for at > 0 && strings.TrimSpace(lines[at-1]) == "" {
		at--
	}
	out := append([]string{}, lines[:at]...)
	out = append(out, line)
	out = append(out, lines[at:]...)
	return strings.Join(out, "\n"), nil
}

// insertBeforeInLine inserts `text` immediately after the last non-space
// character preceding `needle`'s first occurrence.
func insertBeforeInLine(src, needle, text string) (string, error) {
	idx := strings.Index(src, needle)
	if idx < 0 {
		return "", fmt.Errorf("marker not found: %q", needle)
	}
	cut := strings.TrimRight(src[:idx], " \t")
	return cut + text + src[len(cut):], nil
}
