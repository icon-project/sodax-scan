// Below xl the source and destination tracks may shrink (names truncate, with a
// tooltip) so the table fits tablet widths without a horizontal scrollbar.
// Route column layout, shared by the real rows and the loading skeleton so the two
// never drift apart. Source in a fixed column, the arrow centred in a flexible middle
// column, then the destination: arrows and destinations line up down the list.
export const ROUTE_GRID =
    'grid grid-cols-[minmax(6.5rem,9rem)_minmax(1rem,1fr)_minmax(6.5rem,1fr)] xl:grid-cols-[10.5rem_minmax(2rem,1fr)_minmax(10.5rem,1fr)] items-center gap-x-2 xl:gap-x-3 min-w-0'
// Phone cards (below md).
export const ROUTE_GRID_CARD = 'grid grid-cols-[8rem_minmax(1.5rem,1fr)_minmax(8rem,1fr)] items-center gap-x-2 min-w-0'
