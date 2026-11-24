import timeAgo from '@/lib/time-ago'
import Render from '@/lib/render'
import Link from 'next/link'
import helper from '@/lib/helper'
import { AdminDetailProvider, ResubmitBanner, DetailStatus } from '@/components/admin-detail'
import MpcTimeline from '@/components/mpc-timeline'
import CopyButton from '@/components/copy-button'
import { DetailCard, DetailGroup, DetailRow, DetailTime } from '@/components/detail-card'

export default async function MessageDetail({ msgData, meta, isAdmin = false }) {
    // MPC rows are externally written and follow a kind-dependent lifecycle;
    // render the timeline instead of the flat card (R7). Detection is CHAIN-based
    // (ADR-002 revised): a completed MPC flow carries status `executed`, so status
    // cannot detect it — src/dest chain involvement can. The gate sits above the
    // admin resubmit block intentionally (m1): resubmit re-drives the indexer
    // source-tx pipeline, which does not own MPC rows.
    if (helper.isMpcTransaction(msgData)) {
        return <MpcTimeline msgData={msgData} meta={meta} />
    }

    const msgAction = msgData.action_detail || ''
    // Admin gets the interactive status cell (live re-check feedback) + banner;
    // everyone else gets the plain server-rendered pill.
    const canResubmit = isAdmin && msgData.src_network && msgData.src_tx_hash
    const statusNode = canResubmit ? <DetailStatus /> : Render.renderMessageStatus(msgData.status)
    const fill = helper.isSolverMarketPlaceFill(msgData)

    const content = (
        <div className="py-2 flex flex-col">
            {canResubmit && <ResubmitBanner />}
            <DetailCard status={statusNode}>
                <DetailGroup title="Identifiers">
                    <DetailRow label="Serial no" tabular>
                        {/* Same badges as the messages list: SolverMarketPlaceFill, then hub-only (sn == null). */}
                        {fill || msgData.sn == null ? Render.renderSerialNo(msgData) : msgData.sn}
                    </DetailRow>
                    {msgData.intent_tx_hash && (
                        <DetailRow label="Intent hash">
                            <span className="inline-flex items-center gap-1 max-w-full">
                                <Link className="tx-hash hover:underline underline-offset-2 min-w-0 break-all" href={`/messages/search?value=${msgData.intent_tx_hash}`}>
                                    {msgData.intent_tx_hash}
                                </Link>
                                <CopyButton value={msgData.intent_tx_hash} label="Copy intent hash" />
                            </span>
                        </DetailRow>
                    )}
                </DetailGroup>

                <DetailGroup title="Route and hashes">
                    <DetailRow label="Source transaction hash">
                        {fill
                            ? Render.renderChain(msgData.src_network)
                            : Render.renderHashLink(meta.urls.tx[msgData.src_network], msgData.src_network, msgData.src_tx_hash, true)}
                    </DetailRow>
                    <DetailRow label="Destination transaction hash">
                        {/* Hub-only events (sn == null) have no dest leg — mirror the
                            source tx + chain so this row reads symmetrically rather than
                            rendering "-". Intent's true dst chain still shows in Action.
                            SolverMarketPlaceFills have no tx at all, so they show the output leg's chain. */}
                        {fill
                            ? Render.renderChain(msgData.dest_network)
                            : msgData.sn == null
                                ? Render.renderHashLink(meta.urls.tx[msgData.src_network], msgData.src_network, msgData.src_tx_hash, true)
                                : Render.renderHashLink(meta.urls.tx[msgData.dest_network], msgData.dest_network, msgData.dest_tx_hash, true)}
                    </DetailRow>
                </DetailGroup>

                <DetailGroup title="Action and fee">
                    <DetailRow label="Action">{msgAction || <span className="text-fg-muted">—</span>}</DetailRow>
                    {msgData.fee && <DetailRow label="Transaction fee" tabular>{msgData.fee}</DetailRow>}
                    {msgData.slippage && <DetailRow label="Slippage" tabular>{msgData.slippage}</DetailRow>}
                </DetailGroup>

                <DetailGroup title="Timestamps">
                    <DetailRow label="Created" tabular>
                        <DetailTime relative={`${timeAgo(msgData.created_at * 1000)} ago`} utc={new Date(msgData.created_at * 1000).toUTCString()} />
                    </DetailRow>
                    <DetailRow label="Last updated" tabular>
                        <DetailTime
                            relative={msgData.updated_at ? `${timeAgo(msgData.updated_at * 1000)} ago` : ''}
                            utc={msgData.updated_at ? new Date(msgData.updated_at * 1000).toUTCString() : ''}
                        />
                    </DetailRow>
                </DetailGroup>
            </DetailCard>
        </div>
    )

    if (canResubmit) {
        return (
            <AdminDetailProvider initialStatus={msgData.status} messageId={msgData.id} chainId={msgData.src_network} txHash={msgData.src_tx_hash}>
                {content}
            </AdminDetailProvider>
        )
    }
    return content
}
