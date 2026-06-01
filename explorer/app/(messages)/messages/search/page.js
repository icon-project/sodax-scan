import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Loading from './loading'
import FetchData from '@/lib/fetch-data'
import MessageDetail from '@/components/message-detail'
import MessageList from '@/components/message-list'
import IntentSiblings from '@/components/intent-siblings'
import PageTitle from '@/components/page-title'

export default async function SearchPage({ params, searchParams }) {
    const { value } = searchParams
    const rs = await FetchData.search(value)
    const msgData = rs.data[0]

    if (!rs || rs.data.length == 0) {
        notFound()
    }

    const showDetailPage = rs.data.length == 1

    // A single-result search (e.g. a tx hash) renders the detail inline, so it
    // needs the same intent-siblings section as the dedicated detail route.
    // Resolve siblings via the message's intent hash and drop the current row.
    //
    // If the user already searched by the intent hash itself, `rs.data` is
    // exactly the sibling set — no second round-trip needed. Polling on the
    // detail page picks up later siblings within the young window regardless.
    let initialSiblings = []
    let siblingsMeta = rs.meta
    if (showDetailPage && msgData.intent_tx_hash) {
        if (value === msgData.intent_tx_hash) {
            initialSiblings = rs.data.filter((m) => m.id !== msgData.id)
        } else {
            try {
                const related = await FetchData.search(msgData.intent_tx_hash)
                initialSiblings = (related.data || []).filter((m) => m.id !== msgData.id)
                siblingsMeta = related.meta || rs.meta
            } catch {
                // Non-fatal: empty initial list, client will retry if young.
            }
        }
    }

    return (
        <div>
            <PageTitle title={`Search`} />
            <Suspense fallback={<Loading />}>
                {showDetailPage ? <MessageDetail msgData={msgData} meta={rs.meta}></MessageDetail> : <MessageList data={rs.data} meta={rs.meta}></MessageList>}
            </Suspense>

            {showDetailPage && msgData.intent_tx_hash && (
                <IntentSiblings
                    initialSiblings={initialSiblings}
                    meta={siblingsMeta}
                    intentTxHash={msgData.intent_tx_hash}
                    currentMessageId={msgData.id}
                    parentCreatedAtSec={Number(msgData.created_at) || 0}
                />
            )}
        </div>
    )
}
