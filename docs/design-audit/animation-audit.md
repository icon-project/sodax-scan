# Animation audit (2026-11-24, read-only)

Scope: `explorer/` on `design/refresh`. Stack: Next 13.2.1, React 18.2, SWR 2.2.5, Tailwind 3. No motion library installed.
Brand: warm, calm (cream/cherry/soda). No glow, no bounce, no flashy crypto effects. Product is a live data list, so motion must stay under 300 ms and must never move data the user is reading.

## 1. Recon: how the list refreshes today

- `app/(index)/page.tsx:34-38` — `useSWR(['messages', pageSize, pageNumber, status, srcNetwork, destNetwork, actionType, kind], fetcher, { refreshInterval: 2000 })`. Total count (`:39-41`) also polls every 2000 ms. SWR pauses polling while the tab is hidden (default `refreshWhenHidden: false`), so returning to a tab after minutes can deliver a large diff in one go.
- Fetcher `lib/fetch-data.js:16-35`: `skip = pageSize * (page-1)`, `limit = pageSize`, `cache: 'no-store'`. API returns newest first, so a new tx is always inserted at index 0 of page 1.
- Rows ARE keyed by stable id: `message-list.tsx:42` (`<li key={item.id}>`, mobile) and `:79` (`<Link key={item.id}>`, desktop table row). On a same-key refresh, existing rows are reconciled in place (no remount, no flash). A new tx therefore inserts one new DOM node at the top and every other row shifts down 52 px (desktop, fixed `h-[52px]`) or one card height (mobile) in a single frame. That jump is the thing to smooth.
- Any key change (filter, page, page size) gives `isLoading === true` (no `keepPreviousData`), so `page.tsx:122` swaps the whole list for `<SkeletonTable />` and `:125` also hides the pagination bar (layout jump). Page 1 and page N use the same code; they differ only in data. On page 2+, new txs on page 1 push old rows down into page 2's top slot, so "id not seen before" on page 2 means "slid over from page 1", not "just arrived".
- `MessageList` has no `'use client'` and is also rendered by server pages (`/messages` page.js:21, `/messages/search` page.js:53) and by `intent-siblings.jsx:164`. So detection state must live in the caller (a hook in `page.tsx` / `intent-siblings.jsx`), passed down as a plain prop. Do not add hooks inside `MessageList`.
- `.fade-in` on the total (`page.tsx:62`): runs once on mount only. The element is the same node across refreshes (only text changes), so it does NOT re-trigger on refresh. It does run on mount, after `loading.js:14` already faded in a "0", so the visible sequence is fade-in "0", fade-in again, then the number appears instantly. The value jumps 0 → N with no transition.
- Global gotcha (`globals.css:~75`): `a, button, select, input, [role=button]` set `transition-property: color, background-color, border-color, box-shadow, opacity`. A Tailwind `transition-transform` on an `a` is overridden unless the later rule wins; use keyframe `animation` for entrances (animation is unaffected) and add `transform` explicitly wherever a press/transform transition on an `a`/`button` is wanted.
- Table rows are `display: table-row`. Height animation is impossible; `transform` on table-row is inconsistent across browsers (verify in Safari). Entrance on desktop must therefore be opacity + background-colour on the row (both safe), optionally a cell-level transform.

Verdict on feasibility: new-row animation is feasible as-is with ~40 lines and no library, because ids are already stable keys. No framer-motion/auto-animate: framer-motion adds ~30-50 kB gz client JS for one effect, and `AnimatePresence` + table-row layout is awkward; `@formkit/auto-animate` (~2 kB) animates add/remove/move via WAAPI and would also smooth the push-down, but it measures on every one of 2 s polls, offers no first-load/page-switch suppression (it animates the skeleton to list swap and page changes unless disabled imperatively), cannot do the highlight, and uses transforms on table-rows (the Safari risk). Rejected in favour of ~15 lines of CSS plus a hook.

## 2. Shared vocabulary (extend, do not fork)

Add to `tailwind.config.js` (`theme.extend`) and `globals.css`:

```
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);          /* entrances, feedback */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);      /* none needed yet */
```
Existing 150 ms `ease-out` colour transitions stay. All new motion: `transform`/`opacity` plus the one allowed paint property, `background-color`, for the highlight.

## 3. Ranked opportunities (impact vs effort)

### 1. New row slots in at the top of the live list (high impact, medium effort) — the user's headline ask
- Where: `page.tsx:34` (hook), `:122` (prop), `message-list.tsx:42` and `:79` (class on the keyed element).
- Purpose: preventing a jarring change (everything shifts 52 px with no bridge). Frequency: continuous while the page is open, so keep it quiet and short; it is an ambient signal, not a celebration.
- Detection (no library): `useFreshIds(items, resetKey)` in a small `lib/use-fresh-ids.js`:
  - `seen = useRef(null)`, `fresh = useState(new Set())`, `lastKey = useRef(resetKey)`.
  - On `resetKey` change (the SWR key array joined, plus page number): `seen = new Set(ids)`, `fresh = empty`. First data load and every filter/page/size change therefore SEED the set and animate nothing.
  - On a later data render in the same key: `added = ids.filter(id => !seen.has(id))`. If `pageNumber !== 1` (see recon), seed silently. If `added.length > 5` (tab was hidden, bulk catch-up) seed silently. Otherwise add `added` to `fresh` and to `seen`.
  - `fresh` is never trimmed until the next reset. Removing the class mid-animation would cut it off; a keyframe animation does not replay while the element stays mounted, so a persistent class is harmless. Do the set update in an effect (`useEffect` on `items`) so render stays pure; React 18 StrictMode double-run is safe because the diff is against `seen`.
  - Pass `freshIds` (array) to `MessageList` as optional prop; default empty so server pages are unchanged.
- Desktop table row (`message-list.tsx:79`): add class `row-enter` when `fresh.includes(item.id)`:
  ```
  @keyframes row-enter {
    from { opacity: 0; background-color: theme('colors.soda-on-soda'); }
    40%  { opacity: 1; }
    to   { opacity: 1; background-color: theme('colors.white'); }
  }
  .row-enter { animation: row-enter 1200ms var(--ease-out) both; }
  ```
  Opacity 0 → 1 over the first ~480 ms (40 % of 1200); the soda-on-soda (`#F6E799`, cream-yellow, it is already the hover-twin colour in `intent-siblings.jsx:51`, so on-brand) tint fades to white over the full 1200 ms. Note `hover:bg-almost-white` still works after the animation ends (`both` fill leaves `background-color: white`, which would defeat hover: use `animation-fill-mode: backwards` instead of `both`).
- Push-down smoothing, desktop (optional second step, needs browser verification): animate cells, not the row. `.row-enter > div` could slide in with `translateY(-8px) → 0` over 320 ms, but the 52 px shift of the rows below still teleports. The cheap, honest fix is a FLIP on the existing rows: wrap nothing, instead on `fresh` change set `style="transform: translateY(-52px)"` on each non-new cell... too fragile on table layout. Recommendation: ship the fade + tint only on desktop; the tint draws the eye to the new row, which is what makes a teleport read as "something arrived". Revisit a div-grid refactor only if the user still sees jumpiness.
- Mobile card (`message-list.tsx:42`, `<li>` is block layout, so height animates): wrap with grid-rows reveal:
  ```
  @keyframes card-enter {
    from { grid-template-rows: 0fr; opacity: 0; transform: translateY(-6px); }
    to   { grid-template-rows: 1fr; opacity: 1; transform: translateY(0); }
  }
  li.card-enter { display: grid; animation: card-enter 280ms var(--ease-out) backwards; }
  li.card-enter > a { overflow: hidden; min-height: 0; }
  ```
  plus the same 1200 ms tint on the card's inner `Link` background (`bg-white` → soda-on-soda → white). Because list gap is `gap-2` the 0fr start also needs `margin-bottom: -0.5rem` → 0 to avoid a gap pop; test at 375 px. Grid-template-rows interpolation is supported in Chrome 107+, Safari 16+, Firefox 66+.
- Stagger: none (new rows arrive 1-2 at a time). If 2-5 arrive together, stagger 40 ms via `animation-delay: calc(var(--i) * 40ms)` with `--i` the index in `added`.
- Reduced motion: the global guard (`globals.css`, `animation-duration: .01ms`) already collapses it, but that would also skip the tint instantly. Gentler fallback: inside `@media (prefers-reduced-motion: reduce)`, `.row-enter { animation: row-tint 1200ms linear backwards }` that only fades the background tint (no opacity change, no transform). Non-moving colour change is acceptable and still marks the new row. Add the selector to the exclusion list like `.animate-pulse, .fade-in` so the blanket `animation: none` does not catch it, or use `!important` override of duration.
- Effort: ~40 lines (hook 25, CSS 15, two class edits). Biggest risk: the page-1-only and >5 guards; unit-test the hook (vitest is configured).

### 2. Skeleton → content, and no skeleton flash on filter/page change (high impact, low effort)
- Where: `page.tsx:34` (add `keepPreviousData: true` in SWR options, SWR 2.2.5 supports it), `:122`, `:125`.
- Today: every filter/page/size click replaces the list with the skeleton and hides the pagination bar, so the page height collapses and re-expands (jarring), and content pops in.
- Spec: keep previous rows on screen during a key change; while `messagesRes.isLoading || (isValidating && keyChanged)` render the list wrapper at `opacity: .6`, `transition: opacity 150ms ease-out`, `pointer-events: none` (not a skeleton). Pagination bar stays mounted. Initial load only: skeleton, then content wrapper gets existing `.fade-in` (opacity 0 → 1, 200 ms ease-out) so the swap is a cross-fade rather than a pop. Interplay with #1: `resetKey` change still seeds the fresh set, and with `keepPreviousData` the old rows persist until new data arrive; seed on the first data render whose key differs from the previous one.
- Purpose: preventing a jarring change / state indication. Frequency: tens/day. Opacity only, so it stays inside the 100-200 ms budget.
- Reduced motion: opacity dim stays (it is state, not motion); `.fade-in` is already `animation: none` under reduce.
- Effort: low (3 edits). Caveat: `isLoading` stays false with keepPreviousData; use `isValidating` plus a key compare for the dim state.

### 3. Total messages counter (medium impact, low effort)
- Where: `page.tsx:57` (mobile) and `:62` (desktop); also the dead-looking `loading.js:14`.
- Today: shows 0 then jumps to N; increments appear instantly; the `.fade-in` does not re-trigger on refresh (see recon).
- Spec A, first load only (rare tier, delight allowed): count up 0 → N over 700 ms, `easeOutCubic` (`1 - (1-t)^3`) via a ~15-line `useCountUp(value)` with `requestAnimationFrame`, `toLocaleString` per frame, `tabular-nums` already prevents width shimmer. Skip count-up when `isLoading` is true.
- Spec B, subsequent increments (every few seconds, so keep near-imperceptible): remount a keyed inner span on value change, `key={total}`, animation `tick 220ms var(--ease-out) backwards`: `from { opacity: .55; transform: translateY(6px) } to { opacity: 1; transform: none }`. The number lands instead of snapping. Do not count up for deltas (+1 to +3 reads as nothing).
- Remove the redundant `fade-in` class from `loading.js:14` (it fades a placeholder "0" that is replaced a moment later) or leave it.
- Reduced motion: no tick, no count-up (set final value immediately).
- Effort: low (one hook + one keyframe).

### 4. Status change on an existing row, e.g. pending → executed (medium impact, trivial effort)
- Where: `lib/render.js:34` (`base` classes on the pill span) and the dot span at `:39`.
- Today: the same span element persists across a poll (row key is stable), so React just swaps classNames: the pill snaps colour. A tiny but meaningful state change goes unnoticed.
- Spec: add `transition-colors duration-300 ease-out` to the pill (`base`) and the dot. Colour-only crossfade: cream/pending → success-base/executed, 300 ms. The label text changes instantly (that is fine; text cannot tween). Because the pill is a `span`, the global `a, button...` transition rule does not interfere.
- Optional extra: reuse hook #1 with a `Map<id,status>` and give the changed row a lighter tint (`.row-enter` tint at 50 % opacity, 800 ms). Only worth doing if #1 ships and the user wants status changes noticed; it uses the same seeded-diff logic.
- Reduced motion: global guard sets transition to 0.01 ms; acceptable (instant colour change, no motion).
- Effort: trivial. Frequency: a few times per row lifetime, low-key.

### 5. Copy-to-clipboard feedback (low-medium impact, low effort)
- Where: `components/copy-button.js:27-36`.
- Today: icon swaps instantly and a "Copied" label appears beside the button (a small layout nudge).
- Spec: key the icon on `copied` and give it `icon-pop 160ms var(--ease-out)`: `from { opacity: 0; transform: scale(.8) } to { opacity: 1; transform: scale(1) }` (never from `scale(0)`). "Copied" label: `fade-in` 150 ms. Add `active:scale-95` with an explicit `transition: transform 100ms ease-out, background-color 150ms, color 150ms` on the button (the global `button` rule omits `transform` from `transition-property`, so Tailwind's `transition-colors` plus an added transform class must be combined into one declaration). Frequency: occasional, so this is allowed to be visible.
- Reduced motion: drop scale, keep opacity change; the existing `role="status"` announcement is unchanged.

### 6. Detail page content and sibling panel (low-medium impact, low effort)
- Where: `components/detail-card.js:8` (card root), `intent-siblings.jsx:164` and `:166-170` (empty ↔ list), `:172-178` (status line), `app/(messages)/messages/[id]/loading.js`.
- Route arrival: apply existing `.fade-in` (200 ms ease-out, opacity only) on `DetailCard` root so the skeleton → card swap is a cross-fade instead of a pop. No per-section stagger (a reading surface, seen tens of times a day).
- Siblings (Watching-for-new-siblings panel, polling 30 s while parent < 5 min old): when a poll adds a sibling, reuse `useFreshIds` (seed from `initialSiblings`, and no page-1 guard needed). New sibling row gets `row-enter` (same spec as #1). Empty placeholder → first sibling list: 200 ms opacity fade on the list. The heading count `(N)` at `:158` may reuse the counter tick from #3 but is not worth it alone.
- Status line (`:172`, "Last checked Xs ago • next check in Ys"): text updates each second; do NOT animate.
- Reduced motion: as #1.

### 7. Row and card hover polish (low impact, trivial effort)
- `message-list.tsx:81`: the cherry accent bar uses `before:opacity-0 group-hover:before:opacity-100`, but pseudo-elements are not covered by the global transition rule, so the bar pops in while the row background fades over 150 ms. Add `before:transition-opacity before:duration-150 before:ease-out`. Gate with `@media (hover: hover) and (pointer: fine)` equivalent (`group-hover` on touch can stick after tap).
- Mobile card (`:45`): add `active:scale-[0.985]` with explicit `transition: transform 100ms var(--ease-out), background-color 150ms` (transform must be added to the `a` rule's list). Subtle press feedback only; it is a navigation target used tens of times a day, so 0.985 max.

## 4. Considered and rejected (reject list)

| Candidate | Where | Killed by |
| --- | --- | --- |
| Row exit animation when a tx falls off the bottom of the page | `message-list.tsx:79` | Frequency + function: occurs every poll with a new tx, the user is reading those rows; requires keeping unmounted rows alive. Instant removal is correct. |
| Staggered or sliding page entrance on first load | `page.tsx`, `loading.js` | Function: dense data table seen constantly; stagger delays reading. Skeleton → content cross-fade (#2) is enough. |
| Animating / pulsing the "Last checked Xs ago" line or a "live" dot | `intent-siblings.jsx:172` | Frequency (changes every second) + function: ambient motion on a status readout; also adds always-on animation the reduced-motion guard must police. |
| Animating `timeAgo` ("3s ago") text in rows | `message-list.tsx:93,59` | Function: values change on every poll; tweening text is noise. |
| Dropdown open/close for filters | `message-filter.tsx` | Already handled: Flowbite's floating theme ships `transition-opacity`; do not layer a second animation on top. Chip colour change already has `transition-colors`. |
| Search focus ring animation | `searchbar.js:18-19` | Ring is `box-shadow`, already inside the global 150 ms transition-property. Nothing to add. |
| Pagination page-to-page slide or row-wise stagger | `pagination.js`, `message-pagination.js` | Frequency + function: paging is a repeated action over data being scanned; #2's 150 ms dim is the only motion earned. Header ticker, skeleton pulse and 150 ms hovers also stay as they are. |
| Page / route transitions (View Transitions, framer-motion) | `app/(index)/layout.js` | Frequency (core navigation) and Next 13.2 has no stable route-transition support; heavy for no gain. |
| auto-animate / framer-motion for the list | see recon | Bundle size, table-row transform risk, cannot express first-load / page-switch suppression or the highlight. |

## 5. Reduced-motion summary

Existing global guard (`globals.css`, `@media (prefers-reduced-motion: reduce)`) already zeroes `animation-duration`/`transition-duration` for everything and has explicit `animation: none` for `.animate-pulse, .fade-in`. New classes need: (a) `.row-enter` gets the gentler colour-only fallback described in #1 (a tint with no opacity or transform is non-vestibular and keeps the "new" signal); (b) `.tick`, `.icon-pop`, `.card-enter` simply fall to the blanket 0.01 ms guard (instant); (c) count-up hook checks `window.matchMedia('(prefers-reduced-motion: reduce)')` and returns the final value; (d) the dim in #2 stays since it is a state change, not motion.

## 6. Recommended first package (3-5 items, one session)

1. **Live-list new-row entrance** (#1) incl. `useFreshIds` with seed-on-first-load, page-1-only and >5-bulk guards, desktop tint + fade, mobile card grid-rows reveal; add unit tests for the hook.
2. **`keepPreviousData` + list cross-fade/dim, pagination stays mounted** (#2): removes the biggest existing jank and shares the key-change reset with #1.
3. **Counter tick + first-load count-up** (#3).
4. **Status pill `transition-colors duration-300`** (#4): one-line change.
5. **Copy-button icon pop and press** (#5) plus hover accent-bar transition (#7, one class): cheap polish bundle.

Defer: detail-page fade and sibling-panel reuse of #1 (#6) to a second package once the hook is proven. Verify desktop table-row behaviour in Safari and mobile at 375 px before shipping; this audit is from code only, feel could not be judged.

Handoff: `improve-animations plan <item>` can turn any row into a self-contained implementation plan.
