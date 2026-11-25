'use client'

import { Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react'
import MessageList from '@/components/message-list'
import MessageFilter from '@/components/message-filter'
import FetchData from '@/lib/fetch-data'
import { Headline } from '@/components/page-title'
import { Hero, HeroOverlap } from '@/components/hero'
import SearchBar from '@/components/searchbar'
import converter from '@/lib/converter'
import useSWR from 'swr'
import SkeletonTable from '@/components/skeleton-table'
import MessagePagination from '@/components/message-pagination'
import helper from '@/lib/helper'
import TotalCounter from '@/components/total-counter'
import useFreshIds from '@/lib/use-fresh-ids'

// Which query each fetched payload belongs to (see useFreshIds).
const dataKeys = new WeakMap<object, string>()

export default function Home() {
    // filter
    const [srcNetwork, setSrcNetwork] = useState('')
    const [destNetwork, setDestNetwork] = useState('')
    const [actionType, setActionType] = useState('')
    const [status, setStatus] = useState('')
    const [kind, setKind] = useState('')

    // pagination
    const [pageSize, setPageSize] = useState(20)
    const [pageNumber, setPageNumber] = useState(1)

    const queryKey = JSON.stringify([pageSize, pageNumber, status, srcNetwork, destNetwork, actionType, kind])
    let messagesRes = useSWR(
        ['messages', pageSize, pageNumber, status, srcNetwork, destNetwork, actionType, kind],
        async () => {
            const res = await FetchData.getMessages(pageSize, pageNumber, status, srcNetwork, destNetwork, actionType, kind)
            // Remember which query this payload answers (response shape unchanged).
            if (res && typeof res === 'object') dataKeys.set(res, queryKey)
            return res
        },
        { refreshInterval: 2000, keepPreviousData: true }
    )
    const dataKey = messagesRes.data ? dataKeys.get(messagesRes.data) : undefined
    // With keepPreviousData the old rows stay up while a new query loads.
    // Not stale on error: never leave the old rows dimmed and inert after a failed fetch.
    const stale = Boolean(messagesRes.data) && dataKey !== queryKey && !messagesRes.error

    // Hold the list wrapper's height while stale so a shorter next page can't pull
    // the pagination nav up mid-swap; released as soon as fresh data lands.
    const listRef = useRef<HTMLDivElement>(null)
    const [heldHeight, setHeldHeight] = useState<number | undefined>(undefined)
    useLayoutEffect(() => {
        setHeldHeight(stale ? listRef.current?.offsetHeight : undefined)
    }, [stale])
    const rowIds = useMemo(() => messagesRes.data?.data?.map((m: { id: string | number }) => m.id), [messagesRes.data])
    const freshIds = useFreshIds(rowIds, dataKey, queryKey, pageNumber)
    const totalMsgRes = useSWR('statistics/total_messages', () => FetchData.getTotalMessages(), {
        refreshInterval: 2000
    })


    const resetFilters = () => {
        setSrcNetwork('')
        setDestNetwork('')
        setActionType('')
        setStatus('')
        setKind('')
    }
    const filtersActive = Boolean(srcNetwork || destNetwork || actionType || status || kind)

    return (
        <div>
            <Hero>
            <div className="py-2 xl:py-6 xl:flex xl:items-end xl:justify-between w-full">
                <div className="xl:basis-8/12">
                    <Headline before="Explore" accent="all" after="messages" className="pb-3" />
                    <SearchBar showFull={true} />
                </div>
                <div className="md:hidden flex items-baseline gap-2 pt-3 text-white">
                    <span className="text-xs uppercase tracking-wider text-white">Total Activity</span>
                    <span className="text-2xl text-soda-bright leading-none tabular-nums"><TotalCounter value={totalMsgRes.data?.data.total} /></span>
                </div>
                <div className="mt-4 xl:mt-0 xl:basis-4/12 hidden md:flex flex-row-reverse items-end">
                    <div className="px-4 text-right hidden md:block">
                        <div className="text-xs uppercase tracking-wider text-cherry-brighter mb-1">Total Activity</div>
                        <div className="text-5xl xl:text-6xl font-normal text-soda-bright leading-none tabular-nums"><TotalCounter value={totalMsgRes.data?.data.total} /></div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <MessageFilter
                srcNetwork={srcNetwork}
                destNetwork={destNetwork}
                actionType={actionType}
                status={status}
                kind={kind}
                srcNetworkChanged={(value) => {
                    const networkId = helper.NETWORK_MAPPINGS[value]
                    setSrcNetwork((prev) => {
                        if (!networkId) return '';
                        const networkIdStr = String(networkId);
                        const values = prev ? prev.split(",") : [];
                        if (values.includes(networkIdStr)) {
                            return values.filter((v) => v !== networkIdStr).join(",");
                        }
                        return [...values, networkIdStr].join(",");
                    })
                }}
                destNetworkChanged={(value) => {
                    const networkId = helper.NETWORK_MAPPINGS[value]
                    console.log("destNetworkChanged", value, networkId)
                    setDestNetwork((prev) => {
                        if (!networkId) return '';
                        const networkIdStr = String(networkId);
                        const values = prev ? prev.split(",") : [];
                        if (values.includes(networkIdStr)) {
                            return values.filter((v) => v !== networkIdStr).join(",");
                        }
                        return [...values, networkIdStr].join(",");
                    })
                }}
                actionTypeChanged={(value) => {
                    setActionType((prev) => {
                        if (!value) return '';
                        const values = prev ? prev.split(",") : [];
                        if (values.includes(value)) {
                            return values.filter((v) => v !== value).join(",");
                        }
                        return [...values, value].join(",");
                    });
                }}
                statusChanged={(value) => {
                    setStatus(value)
                }}
                kindChanged={(value) => {
                    setKind(value)
                }}
                resetClicked={resetFilters}
            />

            </Hero>

            <HeroOverlap>
            {/* Message List */}
            {/* SWR 2.4 reports isLoading for every uncached key even with keepPreviousData,
                so only fall back to the skeleton when there are no rows to keep. */}
            {messagesRes.isLoading && !messagesRes.data ? (
                <SkeletonTable />
            ) : (
                <div ref={listRef} aria-busy={stale} style={heldHeight ? { minHeight: heldHeight } : undefined} className={`[overflow-anchor:none] transition-opacity duration-150 ease-out ${stale ? 'opacity-60 pointer-events-none' : ''}`}>
                    <MessageList data={messagesRes.data?.data} meta={messagesRes.data?.meta} showPagination={false} onReset={resetFilters} filtersActive={filtersActive} freshIds={freshIds}></MessageList>
                </div>
            )}

            {/* Paging stays mounted while a new query loads */}
            {messagesRes.data && (
                <MessagePagination
                    totalPages={messagesRes.data?.meta.pagination.total}
                    pageSize={pageSize}
                    pageNumber={pageNumber}
                    pageSizeChanged={(value) => {
                        setPageSize(value)
                    }}
                    pageNumberChanged={(value) => {
                        setPageNumber(value)
                    }}
                />
            )}
            </HeroOverlap>
        </div>
    )
}
