// Shared building blocks for the message detail card (message-detail.js and
// mpc-timeline.js): a card with a title row (status pill on the right) and rows
// grouped into labelled sections separated by cream-white dividers.
// Below md each row stacks label over value; from md up it is a two-column grid.

export function DetailCard({ title = 'Message detail', status, children }) {
    return (
        <div className="bg-white rounded-regular shadow-card overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-4 md:px-6 border-b border-cream-white">
                <h2 className="text-lg font-bold text-espresso">{title}</h2>
                <div className="shrink-0">{status}</div>
            </div>
            {children}
        </div>
    )
}

export function DetailGroup({ title, children }) {
    return (
        <section>
            <h3 className="px-4 py-2 md:px-6 text-xs font-medium text-clay-dark bg-almost-white border-b border-cream-white">{title}</h3>
            <dl className="m-0">{children}</dl>
        </section>
    )
}

export function DetailRow({ label, children, tabular = false }) {
    return (
        <div className="grid gap-1 px-4 py-3 md:grid-cols-[11rem_minmax(0,1fr)] md:gap-6 md:px-6 xl:grid-cols-[14rem_minmax(0,1fr)] border-b border-cream-white last:border-b-0">
            <dt className="text-sm font-medium text-clay-dark md:pt-0.5">{label}</dt>
            <dd className={`m-0 min-w-0 text-espresso [overflow-wrap:anywhere] ${tabular ? 'tabular-nums' : ''}`}>{children}</dd>
        </div>
    )
}

// Relative time (espresso) over the absolute UTC timestamp (clay-dark).
export function DetailTime({ relative, utc }) {
    if (!relative) return <span className="text-clay-dark">—</span>
    return (
        <>
            <div>{relative}</div>
            <div className="text-sm text-clay-dark">{utc}</div>
        </>
    )
}
