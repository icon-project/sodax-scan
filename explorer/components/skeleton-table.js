export default function SkeletonTable({ count = 10 }) {
    // Generating {count = 30} skeletons to match the size of the list.
    return (
        <div className="py-2">
            <div className="md:hidden flex flex-col gap-2">
                {Array.from({ length: count }).map((_, index) => (
                    <div key={index} className="bg-white rounded-regular shadow-md p-4 animate-pulse">
                        <div className="flex items-center justify-between">
                            <div className="h-6 w-24 bg-cream-white rounded-full"></div>
                            <div className="h-4 w-16 bg-cream-white rounded-full"></div>
                        </div>
                        <div className="mt-3 h-6 w-full bg-cream-white rounded-full"></div>
                        <div className="mt-3 flex justify-between">
                            <div className="h-4 w-20 bg-cream-white rounded-full"></div>
                            <div className="h-4 w-28 bg-cream-white rounded-full"></div>
                        </div>
                    </div>
                ))}
            </div>
            <div className="hidden md:block relative overflow-x-auto shadow-md sm:rounded-lg">
                <div className="table w-full border-collapse">
                    <div className="table-header-group">
                        <div className="table-row uppercase text-xs tracking-wide text-clay-dark bg-cream-white">
                            <div className="table-cell px-1 py-1 xl:px-3 xl:py-3">Status</div>
                            <div className="table-cell px-1 py-1 xl:px-3 xl:py-3">Serial No</div>
                            <div className="table-cell px-1 py-1 xl:px-3 xl:py-3">Source Tx Hash</div>
                            <div className="table-cell px-1 py-1 xl:px-3 xl:py-3">Destination Tx Hash</div>
                            <div className="table-cell px-1 py-1 xl:px-3 xl:py-3">Action</div>
                            <div className="table-cell px-1 py-1 xl:px-3 xl:py-3 text-right">Created</div>
                        </div>
                    </div>
                    <div className="table-row-group">
                        {Array.from({ length: count }).map((_, index) => (
                            <Skeleton key={index} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

function SkeletonTableCell() {
    return (
        <div className="max-w-sm animate-pulse">
            <div className="h-5 bg-cream-white rounded-full w-full"></div>
        </div>
    )
}

function Skeleton() {
    return (
        <div className="table-row bg-white hover:bg-almost-white border-b border-light-grey h-14">
            <div className="table-cell align-middle px-1 py-1 xl:px-3 xl:py-3">
                <SkeletonTableCell />
            </div>
            <div className="table-cell align-middle px-1 py-1 xl:px-3 xl:py-3">
                <SkeletonTableCell />
            </div>
            <div className="table-cell align-middle px-1 py-1 xl:px-3 xl:py-3">
                <SkeletonTableCell />
            </div>
            <div className="table-cell align-middle px-1 py-1 xl:px-3 xl:py-3">
                <SkeletonTableCell />
            </div>
            <div className="table-cell align-middle px-1 py-1 xl:px-3 xl:py-3">
                <SkeletonTableCell />
            </div>
            <div className="table-cell align-middle px-1 py-1 xl:px-3 xl:py-3 text-right">
                <SkeletonTableCell />
            </div>
        </div>
    )
}
