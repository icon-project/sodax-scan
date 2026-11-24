'use client'

import { Suspense, useState } from 'react'
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

    let messagesRes = useSWR(
        ['messages', pageSize, pageNumber, status, srcNetwork, destNetwork, actionType, kind],
        () => FetchData.getMessages(pageSize, pageNumber, status, srcNetwork, destNetwork, actionType, kind),
        { refreshInterval: 2000 }
    )
    const totalMsgRes = useSWR('statistics/total_messages', () => FetchData.getTotalMessages(), {
        refreshInterval: 2000
    })


    return (
        <div>
            <Hero>
            <div className="py-2 xl:py-6 xl:flex xl:items-end xl:justify-between w-full">
                <div className="xl:basis-8/12">
                    <Headline before="Explore" accent="all" after="messages" className="pb-3" />
                    <SearchBar showFull={true} />
                </div>
                <div className="md:hidden flex items-baseline gap-2 pt-3 text-white">
                    <span className="text-xs uppercase tracking-wider text-white">Total Messages</span>
                    <span className="text-2xl text-soda-bright leading-none tabular-nums">{totalMsgRes.isLoading ? 0 : totalMsgRes.data?.data.total?.toLocaleString('en-US')}</span>
                </div>
                <div className="mt-4 xl:mt-0 xl:basis-4/12 hidden md:flex flex-row-reverse items-end">
                    <div className="px-4 text-right hidden md:block">
                        <div className="text-xs uppercase tracking-wider text-cherry-brighter mb-1">Total Messages</div>
                        <div className="text-5xl xl:text-6xl font-normal text-soda-bright leading-none tabular-nums fade-in">{totalMsgRes.isLoading ? 0 : totalMsgRes.data?.data.total?.toLocaleString('en-US')}</div>
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
                resetClicked={() => {
                    setSrcNetwork('')
                    setDestNetwork('')
                    setActionType('')
                    setStatus('')
                    setKind('')
                }}
            />

            </Hero>

            <HeroOverlap>
            {/* Message List */}
            {messagesRes.isLoading ? <SkeletonTable /> : <MessageList data={messagesRes.data?.data} meta={messagesRes.data?.meta} showPagination={false}></MessageList>}

            {/* Paging */}
            {!messagesRes.isLoading && (
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
