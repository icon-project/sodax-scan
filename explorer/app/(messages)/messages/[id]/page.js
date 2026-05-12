import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Loading from './loading'
import FetchData from '@/lib/fetch-data'
import MessageDetail from '@/components/message-detail'
import IntentSiblings from '@/components/intent-siblings'
import PageTitle from '@/components/page-title'

export default async function MessageDetailPage({ params, searchParams }) {
    const { id } = params
    const rs = await FetchData.getMessageById(id)

    const msgData = rs.data[0]
    if (!msgData) {
        notFound()
    }

    // If this message belongs to an intent, fetch siblings server-side for the
    // initial render. The client component takes over polling for new siblings
    // while the parent message is still young.
    let initialSiblings = []
    let siblingsMeta = rs.meta
    if (msgData.intent_tx_hash) {
        try {
            const related = await FetchData.search(msgData.intent_tx_hash)
            initialSiblings = (related.data || []).filter((m) => m.id !== msgData.id)
            siblingsMeta = related.meta || rs.meta
        } catch {
            // Non-fatal: empty initial list, client will retry if young.
        }
    }

    return (
        <div>
            <PageTitle title={'Message Detail'} />

            <Suspense fallback={<Loading />}>
                <MessageDetail msgData={msgData} meta={rs.meta}></MessageDetail>
            </Suspense>

            {msgData.intent_tx_hash && (
                <IntentSiblings
                    initialSiblings={initialSiblings}
                    meta={siblingsMeta}
                    intentTxHash={msgData.intent_tx_hash}
                    currentMessageId={msgData.id}
                    parentCreatedAtSec={Number(msgData.created_at) || 0}
                />
            )}

            <div className="py-4 flex flex-row-reverse">
                <Link className="hover:underline underline-offset-2 text-sm pr-2" href={`/`}>
                    Back to Messages
                </Link>
            </div>
        </div>
    )
}
