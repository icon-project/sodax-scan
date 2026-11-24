// Loading skeleton that mirrors the real list: cards below md, the 5-column
// table (same header, paddings and 52px rows) from md up. Pulse is disabled
// under prefers-reduced-motion (globals.css).
export default function SkeletonTable({ count = 10 }) {
    return (
        <div className="py-2" role="status" aria-busy="true">
            <span className="sr-only">Loading messages…</span>
            <div className="md:hidden flex flex-col gap-2" aria-hidden="true">
                {Array.from({ length: count }).map((_, index) => (
                    <div key={index} className="bg-raised rounded-regular shadow-card p-4 animate-pulse">
                        <div className="flex items-center justify-between">
                            <div className="h-6 w-24 bg-skeleton rounded-full"></div>
                            <div className="h-4 w-16 bg-skeleton rounded-full"></div>
                        </div>
                        <div className="mt-3 h-6 w-full bg-skeleton rounded-full"></div>
                        <div className="mt-3 flex justify-between">
                            <div className="h-4 w-20 bg-skeleton rounded-full"></div>
                            <div className="h-4 w-28 bg-skeleton rounded-full"></div>
                        </div>
                    </div>
                ))}
            </div>
            <div className="hidden md:block relative overflow-x-auto shadow-card rounded-regular" aria-hidden="true">
                <div className="table w-full border-collapse bg-raised">
                    <div className="table-header-group">
                        <div className="table-row uppercase text-left text-xs tracking-wide text-fg-muted bg-header border-b border-line">
                            <div className="table-cell px-3 py-3 xl:px-4">Status</div>
                            <div className="table-cell px-3 py-3 xl:px-4">ID / Type</div>
                            <div className="table-cell px-3 py-3 xl:px-4 w-full">Route</div>
                            <div className="table-cell px-3 py-3 xl:px-4">Action</div>
                            <div className="table-cell px-3 py-3 xl:px-4 text-right">Created</div>
                        </div>
                    </div>
                    <div className="table-row-group">
                        {Array.from({ length: count }).map((_, index) => (
                            <SkeletonRow key={index} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

function Bar({ className }) {
    return <div className={`h-4 bg-skeleton rounded-full ${className}`}></div>
}

function SkeletonRow() {
    return (
        <div className="table-row bg-raised border-b border-line h-[52px]">
            <div className="table-cell align-middle px-3 py-2 xl:px-4">
                <div className="animate-pulse"><div className="h-6 w-24 bg-skeleton rounded-full"></div></div>
            </div>
            <div className="table-cell align-middle px-3 py-2 xl:px-4">
                <div className="animate-pulse"><Bar className="w-20" /></div>
            </div>
            <div className="table-cell align-middle px-3 py-2 xl:px-4">
                <div className="animate-pulse flex items-center gap-2">
                    <div className="h-6 w-6 bg-skeleton rounded-full"></div>
                    <Bar className="w-20" />
                    <div className="h-6 w-6 bg-skeleton rounded-full ml-3"></div>
                    <Bar className="w-20" />
                </div>
            </div>
            <div className="table-cell align-middle px-3 py-2 xl:px-4">
                <div className="animate-pulse"><Bar className="w-24" /></div>
            </div>
            <div className="table-cell align-middle px-3 py-2 xl:px-4">
                <div className="animate-pulse flex justify-end"><Bar className="w-16" /></div>
            </div>
        </div>
    )
}
