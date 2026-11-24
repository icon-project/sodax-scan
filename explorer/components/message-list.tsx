import timeAgo from '@/lib/time-ago'
import Link from 'next/link'
import Pagination from './pagination'
import Render from '@/lib/render'
import actionLabel from '@/lib/action-label'
import type { MessageListProps } from '@/types'

function EmptyState({ onReset, filtersActive }: { onReset?: () => void; filtersActive?: boolean }) {
    const canReset = filtersActive && onReset
    return (
        <div role="status" className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center bg-white rounded-regular shadow-card">
            <p className="text-base font-medium text-espresso">{canReset ? 'No messages match these filters' : 'No messages found'}</p>
            <p className="text-sm text-clay-dark">{canReset ? 'Try removing a filter to see more results.' : 'Check back in a moment or try a different search.'}</p>
            {canReset && (
                <button
                    type="button"
                    onClick={onReset}
                    className="mt-1 inline-flex items-center justify-center h-10 px-5 rounded-full bg-cherry-soda text-white text-sm font-medium transition-colors duration-150 hover:bg-cherry-dark active:bg-cherry-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cherry-soda"
                >
                    Reset filters
                </button>
            )}
        </div>
    )
}

export default function MessageList({ data, meta, showPagination, onReset, filtersActive, freshIds }: MessageListProps) {
    if (data && data.length === 0) {
        return (
            <div className="py-2">
                <EmptyState onReset={onReset} filtersActive={filtersActive} />
                {showPagination && meta && <Pagination totalPages={meta.pagination.total} pageNumber={meta.pagination.number} pageSize={meta.pagination.size} />}
            </div>
        )
    }
    return (
        <div className="py-2">
          <div className="md:relative md:overflow-x-auto md:shadow-card md:rounded-regular">
            {/* Below md: one card per message. From md up: the table below, unchanged. */}
            <ul className="md:hidden flex flex-col gap-2 list-none p-0 m-0">
                {data?.map((item) => (
                    <li key={item.id} className={freshIds?.has(item.id) ? 'card-enter' : undefined}>
                        <Link
                            href={`/messages/${item.id}`}
                            className="block min-w-0 bg-white rounded-regular shadow-card p-4 active:bg-almost-white hover:bg-almost-white"
                        >
                            <div className="flex items-center justify-between gap-2">
                                {Render.renderMessageStatus(item.status)}
                                <span className="text-xs text-clay-dark tabular-nums whitespace-nowrap">{timeAgo(item.created_at * 1000)} ago</span>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm min-w-0">
                                <div className="min-w-0">{Render.renderSrcHashLink(item, meta)}</div>
                                <span aria-hidden="true" className="text-clay-dark">&rarr;</span>
                                <div className="min-w-0">{Render.renderDestHashLink(item, meta)}</div>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-clay-dark">
                                <span className="tabular-nums">{Render.renderSerialNo(item)}</span>
                                <span className="break-all">{actionLabel(item.action_type)}</span>
                            </div>
                        </Link>
                    </li>
                ))}
            </ul>

            <div className="hidden md:block">
                <div className="table w-full border-collapse min-h-32 bg-white">
                    <div className="table-header-group">
                        <div className="table-row uppercase text-left text-xs tracking-wide text-clay-dark bg-almost-white border-b border-cream-white">
                            <div className="table-cell px-3 py-3 xl:px-4">Status</div>
                            <div className="table-cell px-3 py-3 xl:px-4">ID / Type</div>
                            <div className="table-cell px-3 py-3 xl:px-4 w-full">Route</div>
                            <div className="table-cell px-3 py-3 xl:px-4">Action</div>
                            <div className="table-cell px-3 py-3 xl:px-4 text-right">Created</div>
                        </div>
                    </div>

                    <div className="table-row-group">
                        {data?.map((item) => (
                            <Link key={item.id} className={`group table-row bg-white hover:bg-almost-white border-b border-cream-white h-[52px]${freshIds?.has(item.id) ? ' row-enter' : ''}`} href={`/messages/${item.id}`}>
                                {/* Hover: cream bg (row) + cherry accent bar on the first cell's left edge. */}
                                <div className="relative table-cell align-middle px-3 py-2 xl:px-4 before:absolute before:left-0 before:inset-y-0 before:w-[3px] before:bg-cherry-soda before:opacity-0 group-hover:before:opacity-100">
                                    {Render.renderMessageStatus(item.status)}
                                </div>
                                <div className="table-cell align-middle px-3 py-2 xl:px-4 tabular-nums">{Render.renderSerialNo(item)}</div>
                                <div className="table-cell align-middle px-3 py-2 xl:px-4">{Render.renderRoute(item)}</div>
                                <div className="table-cell align-middle px-3 py-2 xl:px-4 whitespace-nowrap">{actionLabel(item.action_type)}</div>
                                <div className="table-cell align-middle px-3 py-2 xl:px-4 text-right tabular-nums whitespace-nowrap text-clay-dark">{timeAgo(item.created_at * 1000)} ago</div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
            {/* {showPagination ? (
                    <Pagination totalPages={meta.pagination.total} pageNumber={meta.pagination.number} pageSize={meta.pagination.size} />
                ) : (
                    <div className="py-4 px-4 text-center hover:underline underline-offset-2">
                        {data?.length == 0 ? <div>NO MESSAGES</div> : <Link href={`/messages`}>VIEW ALL MESSAGES</Link>}
                    </div>
                )} */}

            {showPagination && meta && <Pagination totalPages={meta.pagination.total} pageNumber={meta.pagination.number} pageSize={meta.pagination.size} />}
          </div>
        </div>
    )
}
