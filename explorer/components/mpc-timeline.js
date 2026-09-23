import timeAgo from '@/lib/time-ago'
import Render from '@/lib/render'
import helper from '@/lib/helper'
import Script from 'next/script'

// MpcTimeline renders the kind-dependent MPC lifecycle stepper for a message row
// on an MPC chain. Non-MPC rows never reach here — message-detail.js gates on
// helper.isMpcTransaction (chain-based, ADR-002) before rendering this component
// (R7). The step set comes from helper.deriveMpcSteps (kind-aware, ADR-006):
//   deposit:    Source -> Attested -> Minted -> Swept (memo chains drop Swept)
//   withdrawal: Source -> Attested -> Hub-burned -> Released
//   transfer:   Source -> Attested -> Released
//
// Each present step shows a tx-hash link (renderHashLink with the step's own
// *_network tx base; the Attested step is fixed to NEAR) + chain icon + state
// label; there is NO per-step timestamp (that data does not exist — R5). A step
// whose *_tx_hash is NULL renders as not-yet-reached rather than as an error. The
// terminal step per kind and mode (R6: deposit sweep⇒swept / memo⇒minted;
// withdrawal & transfer⇒released) carries NO visual emphasis — it is marked only
// by a plain " (destination)" text suffix on its label; all steps render alike.
export default async function MpcTimeline({ msgData, meta }) {
    const { steps } = helper.deriveMpcSteps(msgData)
    const msgAction = msgData.action_detail || ''

    const labelCell = 'table-cell xl:w-96 px-3 py-2 xl:px-6 xl:py-4 font-medium whitespace-normal xl:whitespace-nowrap'
    const valueCell = 'table-cell px-3 py-2 xl:px-6 xl:py-4'

    return (
        <div className="py-2 flex flex-col">
            <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
                <div className="table border-collapse w-full text-base text-left text-gray-900">
                    <div className="xl:table-header-group hidden">
                        <div className="table-row font-medium text-xl uppercase text-left text-espresso bg-cream-white">
                            <div className="table-cell px-2 py-1 xl:px-6 xl:py-3">Message Detail</div>
                            <div className="table-cell px-2 py-1 xl:px-6 xl:py-3"></div>
                        </div>
                    </div>
                    <div className="table-row-group">
                        <div className="table-row bg-white border-b">
                            <div className={labelCell}>Status:</div>
                            <div className={valueCell}>{Render.renderMessageStatus(msgData.status)}</div>
                        </div>
                        <div className="table-row bg-white border-b">
                            <div className={labelCell}>Serial No:</div>
                            {/* MPC rows show the shared "MPC" badge (Render.renderSerialNo),
                                the same marker used in the list Serial-No column. */}
                            <div className={valueCell}>{Render.renderSerialNo(msgData)}</div>
                        </div>
                        <div className="table-row bg-white border-b">
                            <div className={labelCell}>Source transaction hash:</div>
                            <div className={valueCell}>
                                {Render.renderHashLink(meta.urls.tx[msgData.src_network], msgData.src_network, msgData.src_tx_hash, true)}
                            </div>
                        </div>

                        {steps.map((step) => (
                            <div key={step.key} className="table-row bg-white border-b">
                                <div className={labelCell}>
                                    <span>
                                        {step.label}
                                        {step.terminal ? ' (destination)' : ''}
                                    </span>
                                </div>
                                <div className={valueCell}>
                                    {step.reached
                                        ? Render.renderHashLink(meta.urls.tx[step.network], step.network, step.hash, true)
                                        : <span className="text-clay-dark">— pending</span>}
                                </div>
                            </div>
                        ))}

                        <div className="table-row bg-white border-b">
                            <div className={labelCell}>Action:</div>
                            <div className={valueCell}>{msgAction}</div>
                        </div>

                        <div className="table-row bg-white border-b">
                            <div className={labelCell}>Created:</div>
                            <div className={valueCell}>{timeAgo(msgData.created_at * 1000)} ago ({new Date(msgData.created_at * 1000).toUTCString()})</div>
                        </div>
                        <div className="table-row bg-white border-b">
                            <div className={labelCell}>Last updated at:</div>
                            <div className={valueCell}>
                                {msgData.updated_at
                                    ? `${timeAgo(msgData.updated_at * 1000)} ago (${new Date(msgData.updated_at * 1000).toUTCString()})`
                                    : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Script>{`
            for(var i=0;i<document.getElementsByClassName("copy-hash").length;i++){
                document.getElementsByClassName("copy-hash")[i].onclick = function(){ navigator.clipboard.writeText(this.previousSibling.innerText); }
            }
            `}</Script>
        </div>
    )
}
