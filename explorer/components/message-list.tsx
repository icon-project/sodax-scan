import timeAgo from '@/lib/time-ago'
import Link from 'next/link'
import Pagination from './pagination'
import Render from '@/lib/render'
import type { MessageListProps } from '@/types'

export default function MessageList({ data, meta, showPagination }: MessageListProps) {
    return (
        <div className="py-2">
          <div className="md:relative md:overflow-x-auto md:shadow-card md:rounded-regular">
            {/* Below md: one card per message. From md up: the table below, unchanged. */}
            <ul className="md:hidden flex flex-col gap-2 list-none p-0 m-0">
                {data?.map((item) => (
                    <li key={item.id}>
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
                                <span aria-hidden="true" className="text-clay">&rarr;</span>
                                <div className="min-w-0">{Render.renderDestHashLink(item, meta)}</div>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-clay-dark">
                                <span className="tabular-nums">{Render.renderSerialNo(item)}</span>
                                <span className="break-all">{item.action_type}</span>
                            </div>
                        </Link>
                    </li>
                ))}
                {data?.length == 0 && <li className="text-center py-12 bg-white rounded-regular shadow-card">No messages found. Please try again!</li>}
            </ul>

            <div className="hidden md:block">
                <div className="table w-full border-collapse min-h-32 bg-white">
                    <div className="table-header-group">
                        <div className="table-row uppercase text-left text-xs tracking-wide text-clay-dark bg-cream-white">
                            <div className="table-cell px-1 py-1 xl:px-3 xl:py-3">Status</div>
                            <div className="table-cell px-1 py-1 xl:px-3 xl:py-3">Serial No</div>
                            <div className="table-cell px-1 py-1 xl:px-3 xl:py-3">Source Tx Hash</div>
                            <div className="table-cell px-1 py-1 xl:px-3 xl:py-3">Destination Tx Hash</div>
                            <div className="table-cell px-1 py-1 xl:px-3 xl:py-3">Action</div>
                            <div className="table-cell px-1 py-1 xl:px-3 xl:py-3 text-right">Created</div>
                        </div>
                    </div>

                    <div className="table-row-group">
                        {data?.map((item) => (
                            <Link key={item.id} className="table-row bg-white hover:bg-almost-white border-b border-light-grey h-14" href={`/messages/${item.id}`}>
                                <div className="table-cell align-middle px-1 py-1 xl:px-3 xl:py-3">{Render.renderMessageStatus(item.status)}</div>
                                <div className="table-cell align-middle px-1 py-1 xl:px-3 xl:py-3 tabular-nums">
                                    {Render.renderSerialNo(item)}
                                </div>
                                <div className="table-cell align-middle px-1 py-1 xl:px-3 xl:py-3">
                                    {Render.renderSrcHashLink(item, meta)}
                                </div>
                                <div className="table-cell align-middle px-1 py-1 xl:px-3 xl:py-3">{Render.renderDestHashLink(item, meta)}</div>
                                <div className="table-cell align-middle px-1 py-1 xl:px-3 xl:py-3">{item.action_type}</div>
                                <div className="table-cell align-middle px-1 py-1 xl:px-3 xl:py-3 text-right tracking-tighter tabular-nums">{timeAgo(item.created_at * 1000)} ago</div>
                            </Link>
                        ))}
                    </div>
                    {data?.length == 0 && (
                        <div className="table-row-group w-full h-32">
                            <div className='absolute left-0 w-full text-center mt-12'>No messages found. Please try again!</div>
                        </div>
                    )}
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
