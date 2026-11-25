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
    const activeFilterCount = [srcNetwork, destNetwork, actionType, status, kind].filter(Boolean).length
    const [filtersOpen, setFiltersOpen] = useState(false)

    const toggleCsv = (prev: string, id: string) => {
        const values = prev ? prev.split(",") : [];
        if (values.includes(id)) return values.filter((v) => v !== id).join(",");
        return [...values, id].join(",");
    }
    // Shared by the desktop row and the mobile panel so both bind to the same state.
    const filterProps = {
        srcNetwork,
        destNetwork,
        actionType,
        status,
        kind,
        srcNetworkChanged: (value: string) => {
            const networkId = helper.NETWORK_MAPPINGS[value]
            setSrcNetwork((prev) => (networkId ? toggleCsv(prev, String(networkId)) : ''))
        },
        destNetworkChanged: (value: string) => {
            const networkId = helper.NETWORK_MAPPINGS[value]
            setDestNetwork((prev) => (networkId ? toggleCsv(prev, String(networkId)) : ''))
        },
        actionTypeChanged: (value: string) => {
            setActionType((prev) => (value ? toggleCsv(prev, value) : ''))
        },
        statusChanged: (value: string) => setStatus(value),
        kindChanged: (value: string) => setKind(value),
        resetClicked: resetFilters
    }

    return (
        <div>
            <Hero tightMobile>
            <div className="py-2 xl:py-6 xl:flex xl:items-end xl:justify-between w-full">
                <div className="xl:basis-8/12">
                    <Headline before="Explore" accent="all" after="messages" className="pb-3" />
                    <SearchBar showFull={true} />
                </div>
                <div className="mt-4 xl:mt-0 xl:basis-4/12 hidden md:flex flex-row-reverse items-end">
                    <div className="px-4 text-right hidden md:block">
                        <div className="text-xs uppercase tracking-wider text-cherry-brighter mb-1">Total Messages</div>
                        <div className="text-5xl xl:text-6xl font-normal text-soda-bright leading-none tabular-nums"><TotalCounter value={totalMsgRes.data?.data.total} /></div>
                    </div>
                </div>
            </div>

            {/* Mobile (< md): Filters toggle + total on one row, inline panel below */}
            <div className="md:hidden flex items-center justify-between gap-3 pt-2 text-white">
                <button
                    type="button"
                    aria-expanded={filtersOpen}
                    aria-controls={filtersOpen ? "mobile-filters-panel" : undefined}
                    onClick={() => setFiltersOpen((o) => !o)}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-soda-bright ${
                        activeFilterCount > 0
                            ? 'bg-white border-white text-cherry-dark font-medium hover:bg-almost-white'
                            : 'border-cherry-bright/60 dark:border-cherry-brighter/80 text-white hover:bg-cherry-dark hover:border-cherry-brighter'
                    }`}
                >
                    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="w-4 h-4 shrink-0">
                        <path d="M3 5.5h8M15 5.5h2M3 14.5h2M9 14.5h8" />
                        <circle cx="13" cy="5.5" r="1.8" />
                        <circle cx="7" cy="14.5" r="1.8" />
                    </svg>
                    {activeFilterCount > 0 ? `Filters · ${activeFilterCount}` : 'Filters'}
                </button>
                <div className="flex items-baseline gap-1.5">
                    <span className="text-xl text-soda-bright leading-none tabular-nums"><TotalCounter value={totalMsgRes.data?.data.total} /></span>
                    <span className="text-xs uppercase tracking-wider text-cherry-brighter">messages</span>
                </div>
            </div>
            {filtersOpen && (
                <div id="mobile-filters-panel" className="md:hidden filter-panel-in pt-3">
                    <MessageFilter compact {...filterProps} />
                </div>
            )}

            {/* Filters */}
            <MessageFilter className="hidden md:flex" {...filterProps} />

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
