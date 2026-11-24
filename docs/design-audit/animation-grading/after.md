# Micro-animation re-measurement after tuning (2026-11-24)

> Note: the per-scenario filmstrips and raw data referenced below are archived outside the repo at `~/Github/_scratch-sodax-scan/animation-grading-archive/` (about 12 MB). Only the two `compare-new-row-*.png` images are kept here. Variant **a** shipped; variant b and the `?motion` toggle were removed.


Target: fresh production build at `http://localhost:3100`, branch `design/refresh` at `d3fc344` (FLIP glide, card fade without height reveal, `overflow-anchor:none`, Copied label out of flow, per-digit tick, gentler fade/tint, `?motion=a|b`). Same harness and rubric as `baseline.md` (Playwright 1.64.0, headless, frozen API, Chromium + WebKit, 1440x900 + 375x812). Runs: `?motion=a` everything; `?motion=b` for A1, A3, B1, C1, C3; reduced motion (`prefers-reduced-motion`) in both engines, both motions for A, motion a for B/C/D/E. Harness additions (outside the repo): `Element.animate` call logging, `MOTION=a|b` env, scenarios B2b (+1077), N1 (idle polls), C3 (filter change), new counter/copy probes, `after-report.js`. Baseline outputs were copied aside first (`_scratch-sodax-scan/baseline-copy`).

Filmstrips: `after-a-*.png`, `after-b-*.png` next to the baseline ones (each < 1.5 MB). Side by side before / after a / after b at 0, 40, 80, 160, 320, 720 ms: `compare-new-row-desktop.png`, `compare-new-row-mobile.png` (Chromium).

## Grades

| # | Animation | Baseline | Now | Why |
|---|---|---|---|---|
| A | New row arrives | C+ (desktop C+, mobile C) | **A-** (desktop A-, mobile A-) | Rows below now glide 320 ms on the spec curve, first frame displacement 0 px, no teleport, no 32 px mobile jump, card shadow intact, CLS 0 (was 0.02-0.26). Fade is now ~300 ms to t90. Left at A-: the glide is not applied to a poll that also reorders existing rows (not seen here), and WebKit shows sub-frame start jitter (see issues). |
| B1 | Counter count-up | B+ | **B+** | Unchanged (700 ms easeOutCubic, no tick classes during count-up, 0 `animate()` calls). |
| B2 | Counter increment | B | **A-** | Only the changed digits animate (+3: 1 of 9 characters; +1077: 4 of 9, the unchanged "1,12" never moves), 180 ms, opacity .75 and 4 px, width perfectly stable, no replay on idle polls (N1: 0 tick frames over 6 s). |
| C | Filter / page change | C+ | **A-** | Chromium scrollY now 673 -> 672 (desktop) and 2495 -> 2467 (mobile, the 28 px is the list getting shorter), was 673 -> 204 and 2495 -> 1261. WebKit unchanged and fine. Filter change (new C3): scrollY 0 -> 0, no glide, no skeleton. |
| D | Status pill | A- | **A-** | Unchanged: no `animate()` calls, row not disturbed, 0 CLS. |
| E | Copy button | B- (desktop B+, mobile C) | **A-** (both) | Siblings shift 0 px, document width constant, button moves only by the 0.95 press scale (0.8 px desktop / 1.1 px mobile, same as baseline press), mobile button no longer jumps 46 px. Badge is `position:absolute`, 56.6x24, fully on screen, not clipped by any ancestor (desktop and mobile, both engines). Left at A-: the revert is still a one-frame snap. |
| F | Row hover bar | A- | **A-** | Unchanged (bar t90 83 ms in both engines). |

## Before / after numbers

New row (Chromium; WebKit within one frame of these unless noted). "Shift" = how far the row below must travel.

| Metric | Baseline | After a | After b |
|---|---|---|---|
| Desktop, 1 row: old top row, first-frame displacement / max step per frame | 52 px / 0 (teleport) | 0 px / 11.4 px | 0 px / 11.9 px |
| Desktop, 3 rows (156 px) | 156 / 0 | 0 / 33.9 | 0 / 35.8 |
| Mobile, 1 row (134 px) | 32 px instant, then glide | 0 / 29.3 | 0 / 30.6 |
| Mobile, 3 rows (402 px) | 96 px instant | 0 / 87.6 | 0 / 91.8 |
| Glide spec | none | 320 ms `cubic-bezier(.23,1,.32,1)`, max residual 0.000 (desktop), 0.001 (mobile 3) | 420 ms `cubic-bezier(.16,1,.3,1)`, residual 0.000-0.001 |
| Glide t50 / t90 / settled (<0.5 px) | n/a | 50 / 117 / 217 ms | 50 / 150 / 267 ms |
| New-row opacity t90 | 183 ms | 317 ms (spec 560 ms `(.33,1,.68,1)`, residual 0.000) | 317 ms desktop, 200 ms mobile card |
| Tint peak, % darker than white (luminance) / max-channel delta | 15.2 % / 43 | 15.2 % / 43 | 22.5 % / 68 |
| Tint half-life / fully settled | 167 ms / 533 ms | 617 ms / 1000 ms | 800 ms / 1383 ms |
| Accent bar | none | none | 2 px `rgb(165,92,85)`, alpha 1.0 -> 0.5 at 800 ms -> 0.12 at 1200 ms; confirmed in Chromium and WebKit (computed gradient animates, visible in the WebKit filmstrip at 160 ms) |
| Mobile card shadow while entering | clipped (`overflow:hidden`) | `overflow: visible`, shadow intact | same; card also settles 4 px (-4 -> 0) |
| Mobile card height at first frame | 32 px (grows) | 126 px (final) | 126 px |
| CLS (1.5 s window) desktop 1 / 3 rows | 0.020 / 0.060 | 0 / 0 | 0 / 0 |
| CLS mobile 1 / 3 rows | 0.082 / 0.255 | 0 / 0 | 0 / 0 |
| Dropped frames (>20 ms) / long tasks | 0-1 / 0 | 0 / 0 (WebKit: one 22-26 ms frame in 3 of 4 A runs) | 0 / 0 (WebKit desktop A1: one 87 ms frame, once) |
| `Element.animate` calls on a new row | n/a | 1 per surviving row, transform only (19 for 1 new row, 17 for 3) | same, 420 ms |
| Reduced motion | opacity stays 1, tint only | same: 0 `animate()` calls, opacity 1, no transform animation, no accent bar, tint linear 1200 ms; rows jump instantly | same |

Other animations:

| Metric | Baseline | After |
|---|---|---|
| B2 digits animated (+3 / +1077) | whole number (9 chars) | 1 / 4 of 9; width 304.59 -> 304.59 (desktop), 121.84 constant (mobile) |
| B2 tick | 220 ms, opacity .55, 6 px | 180 ms, opacity .75, 4 px, ends at 167 ms |
| N1: idle polls, tick frames / `animate()` calls | n/a (key replay on any update) | 0 / 0 over 6 s |
| B1 count-up t50 / t90 / t100 | 150 / 383 / 700 ms | 133 / 367 / 683 ms (Chromium), tick during count-up: 0 |
| C1 scrollY across the swap (desktop / mobile, Chromium) | 673 -> 204 / 2495 -> 1261 | 673 -> 672 / 2495 -> 2467 |
| C1 layout-shift sum (Chromium desktop / mobile) | 0.24 / 1.00 | 0.222 / 0.992, see note below |
| C3 filter change scrollY, CLS | n/a | 0 -> 0, CLS 0 (Chromium, WebKit, both viewports) |
| E: sibling rect shift, button left range | 0 / 795.8-796.6 desktop, **254.4-300.1 mobile** | 0 / 795.8-796.6 desktop, **299.0-300.1 mobile** (the sub-pixel range is the press scale) |
| E: CLS | 0.001 mobile | 0 |
| D, F | t90 pill ~200 ms, bar 83 ms | identical |

Note on C1 CLS: the 0.22 / 0.99 that remains in Chromium is not a scroll jump (scrollY is stable). The frozen page-2 response overlaps page 1 by 9 ids, so surviving keyed rows move up the list and Chromium scores them; on mobile the list also gets 28 px shorter and the pagination nav moves with it. Real traffic will overlap the same way. It is visually a content swap under a 0.6 dim, as intended.

## FLIP gating (confirmed by logging every `Element.animate` call)

| Situation | `animate()` calls | Rows glide? |
|---|---|---|
| First load (B1) | 0 | no |
| Page change (C1, C2), both engines/viewports | 0 | no |
| Filter change (C3), both engines/viewports | 0 | no |
| Re-render without data change, 6 s of 2 s polls (N1) | 0 | no |
| Row status change pending -> executed (D) | 0 | no |
| New row (A1/A3) | 1 per surviving row | yes |
| Reduced motion, any scenario | 0 | no, nothing is animated (positions snap) |

## a vs b

| | a (default) | b |
|---|---|---|
| New row signal | tint only, 15 % darker, half-life 0.6 s | tint 22.5 % darker, 2 px accent bar, 1.4 s decay |
| Row glide | 320 ms, settled ~217 ms | 420 ms, settled ~267 ms (softer expo-out) |
| Mobile card | fade only | fade plus 4 px settle |
| Performance | clean in both engines | clean; one 87 ms WebKit frame in A1 desktop (single run) |
| Cost | none | bar needs `@property --row-accent` (works in Chromium and WebKit here), 100 ms longer than `FRESH_CLEAR_MS` |

**Recommendation: ship a.** On a live explorer rows arrive on every 2 s poll in busy periods; b's stronger tint, bar and 1.4 s decay overlap between batches and would leave the top of the table permanently red, while a's tint is already clearly visible (about 43/255 in the red-green-blue channels at peak, half gone at 0.6 s) and settles in 1 s. The glide itself is the real improvement and is almost indistinguishable between the two (a is crisper). If the team feels a is too easy to miss, adopt only b's accent bar (without the stronger tint), since it is the only cue that survives when the tint has faded; its WebKit rendering works.
Cleanup if a is chosen: delete `components/motion-variant.js`, its mount in `app/(index)/layout.js`, the `:root[data-motion='b']` rules, `card-enter-b`, `row-accent`, the `@property`, and the `variant === 'b'` branch in `lib/flip.js:flipTiming`.

## Remaining issues (all minor)

1. **Copy revert is a hard snap.** `components/copy-button.js:19` flips `copied` false at 1500 ms, so the check icon (line 33) and the badge (lines 39-41) vanish in one frame. Fix: keep the badge mounted and toggle `opacity-0`/`opacity-100` with `transition-opacity duration-150`, and swap the icon back with a short `fadeInAnimation` class (or keep `icon-pop` reversed) instead of an instant unmount. Optional.
2. **List height change on page change (mobile, 28 px).** `app/(index)/page.tsx:144`: the busy wrapper collapses when the new page is shorter, moving the pagination nav 28 px up. Fix: while `stale`, add `style={{ minHeight: lastHeight }}` (store `offsetHeight` in a ref before the swap) and release after the fade-in. Optional, only affects mobile (2772 -> 2744).
3. **If b is kept:** `lib/use-fresh-ids.js:36` clears `fresh` after `FRESH_CLEAR_MS = 1500` but b's tint/accent run 1600 ms. The cut is at about 1 / 255 contrast (not visible), but set the constant to 1700 for cleanliness.
4. **WebKit first-frame timing.** In 3 WebKit A runs the old top row is 7-17 px along its glide on the first sampled frame (about one rAF of progress, not a teleport; the largest single-frame step is 37 px for a 156 px shift). Probably sampling jitter of headless WebKit; confirm in real Safari.
5. **WebKit load hitches.** B1 (first load) shows isolated 46-95 ms frames in WebKit headless (baseline max 33 ms), desktop and mobile, in the first 100 ms after hydration, before the count-up begins. Not caused by animation code (0 `animate()` calls, no tick); re-check on real Safari. One-off 50-67 ms frame plus long task also appeared once in Chromium mobile C1/C3 and did not repeat in three reruns of C1.
6. **FLIP does not cover a poll that moves existing rows without an insert** (e.g. server reorders): intended per `lib/flip.js`, noted only for completeness.

## Not verified

Real Safari/iOS hardware, touch (press feedback on mobile), and `prefers-reduced-motion` with a live human feel check. Long-task detection is unavailable in WebKit (observer unsupported); layout shift there is judged by row rects (stable). Filmstrips were reviewed visually for A (desktop and mobile, a and b, WebKit accent bar zoom) and E mobile; the C, B and D strips were checked numerically only.

## Re-run

```
cd /Users/david/Github/_scratch-sodax-scan/anim-harness
MOTION=a node run.js            # writes out/<browser>-<vp>-ma/, filmstrips after-a-*.png
MOTION=b node run.js --only A1,A3,B1,C1,C3
MOTION=a node run.js --rm --only A1,A3,B1,B2,C1,C3,D,E
./shrink.sh && node after-report.js out > out/report-after.txt   # baseline: node after-report.js ../baseline-copy/out
```
