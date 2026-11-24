import timeAgo from '@/lib/time-ago'
import Render from '@/lib/render'
import helper from '@/lib/helper'
import Link from 'next/link'
import CopyButton from '@/components/copy-button'
import { DetailCard, DetailGroup, DetailRow, DetailTime } from '@/components/detail-card'

// MpcTimeline renders the kind-dependent MPC lifecycle stepper for a message row
// on an MPC chain. Non-MPC rows never reach here — message-detail.js gates on
// helper.isMpcTransaction (chain-based, ADR-002) before rendering this component
// (R7). The step set comes from helper.deriveMpcSteps (kind-aware, ADR-006):
//   deposit:    Source -> Attested -> Minted -> Swept (memo chains drop Swept)
//   withdrawal: Source -> Attested -> Released
//   transfer:   Source -> Attested -> Released
// The Released step is labelled "Destination transaction hash:" (its release-leg
// chain id, which may arrive suffixed like "66-0", is resolved to the base id).
//
// Each present step shows a tx-hash link (renderHashLink with the step's own
// *_network tx base; the Attested step is fixed to NEAR) + chain icon + state
// label; there is NO per-step timestamp (that data does not exist — R5). A step
// whose *_tx_hash is NULL renders as not-yet-reached rather than as an error, except
// Attested, which deriveMpcSteps omits once an executed row has its terminal hash. The
// terminal step per kind and mode (R6: deposit sweep⇒swept / memo⇒minted;
// withdrawal & transfer⇒released) carries NO visual emphasis — it is marked only
// by a plain " (destination)" text suffix on its label; all steps render alike.
export default async function MpcTimeline({ msgData, meta }) {
    const { steps } = helper.deriveMpcSteps(msgData)
    const msgAction = msgData.action_detail || ''

    return (
        <div className="py-2 flex flex-col">
            <DetailCard status={Render.renderMessageStatus(msgData.status)}>
                <DetailGroup title="Identifiers">
                    {msgData.mpc_id && <DetailRow label="MPC ID">{msgData.mpc_id}</DetailRow>}
                    {/* MPC rows show the shared "MPC" badge (Render.renderSerialNo),
                        the same marker used in the list Serial-No column. */}
                    <DetailRow label="Serial no" tabular>{Render.renderSerialNo(msgData)}</DetailRow>
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
                        {Render.renderHashLink(meta.urls.tx[msgData.src_network], msgData.src_network, msgData.src_tx_hash, true)}
                    </DetailRow>
                    {steps.map((step) => (
                        <DetailRow
                            key={step.key}
                            label={step.key === 'released' ? 'Destination transaction hash' : `${step.label}${step.terminal ? ' (destination)' : ''}`}
                        >
                            {step.reached
                                ? Render.renderHashLink(meta.urls.tx[step.network], step.network, step.hash, true)
                                : <span className="text-clay-dark">— pending</span>}
                        </DetailRow>
                    ))}
                </DetailGroup>

                <DetailGroup title="Action">
                    <DetailRow label="Action">{msgAction || <span className="text-clay-dark">—</span>}</DetailRow>
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
}
