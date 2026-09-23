import Link from 'next/link'
import Image from 'next/image'
import { ClipboardDocumentIcon } from '@heroicons/react/24/solid'
import helper from "./helper"

// Shorten a hash for list display: first 7 + last 7 chars. The full value is
// still carried in the `data-hash` attribute (used for copy + sibling hover),
// so only the visible label is truncated.
function truncateHash(hash) {
    if (typeof hash !== 'string' || hash.length <= 15) return hash
    return `${hash.slice(0, 7)}…${hash.slice(-7)}`
}

function renderMessageStatus(status) {
    const base = 'uppercase text-xs font-medium tracking-wide rounded-full py-1 inline-block w-24 text-center'
    const s = (status || '').toLowerCase()
    if (s == 'failed') return <span className={`${base} bg-cherry text-white`}>{status}</span>
    if (s == 'rollbacked') return <span className={`${base} bg-soda-bright text-espresso`}>{status}</span>
    if (s == 'pending') return <span className={`${base} bg-cherry-grey text-espresso`}>{status}</span>
    if (s == 'executed') return <span className={`${base} bg-green-200 text-green-900`}>{status}</span>
    if (s == 'delivered') return <span className={`${base} bg-blue-200 text-blue-900`}>{status}</span>
    // `attested` is the one new MPC status (R4) — amber, distinct from the five
    // legacy pills. `pending`/`delivered`/`executed`/`failed`/`rollbacked` reuse
    // their legacy pills above; `routed`/`hub-burned`/`minted`/`swept`/`released`
    // are NOT status values (detail-timeline legs only).
    if (s == 'attested') return <span className={`${base} bg-amber-200 text-amber-900`}>{status}</span>
    // Total fallback (R4): unknown/undefined/null status renders a generic badge
    // rather than returning undefined (which produced a blank pill).
    return <span className={`${base} bg-gray-200 text-gray-800`}>{status || 'unknown'}</span>
}

// Serial-No cell shared by the message list and the MPC detail timeline. An MPC
// row (chain-based detection) shows an "MPC" badge — completed MPC rows carry
// status `executed` and are otherwise indistinguishable from legacy rows in the
// list. Legacy rows are unchanged: a present sn shows the number, a NULL sn keeps
// the "hub-only" badge.
function renderSerialNo(item) {
    const badge = (label) => (
        <span className="uppercase text-xs rounded-full px-2 py-0.5 bg-cream-white text-clay-dark tracking-wide">{label}</span>
    )
    if (helper.isMpcTransaction(item)) return badge('MPC')
    if (item.sn == null) return badge('hub-only')
    return item.sn
}

function renderDestHashLink(item, meta) {
    let scanUrl
    let networkImg
    let linkClass = 'hover:underline inline-block'
    let link
    if (item.rollback_tx_hash) {
        scanUrl = meta.urls.tx[item.src_network]
        networkImg = (
            <div className="w-[3rem]">
                <Image className="relative inline-block" alt={item.dest_network} src={`/images/network-${item.dest_network}.png`} width={24} height={24} />
                <Image
                    className="relative inline-block -left-4 rounded-full bg-white"
                    alt={item.src_network}
                    src={`/images/network-${item.src_network}.png`}
                    width={24}
                    height={24}
                />
            </div>
        )
        linkClass = `${linkClass} relative inline-block -left-4`
        link = <div className={linkClass}><span className="tx-hash" data-hash={item.rollback_tx_hash}>{truncateHash(item.rollback_tx_hash)}</span></div>
    } else if (item.dest_tx_hash) {
        scanUrl = meta.urls.tx[item.dest_network]
        networkImg = <Image alt={item.dest_network} src={`/images/network-${helper.REV_NETWORK_MAPPINGS[item.dest_network]}.png`} width={24} height={24} className="rounded-full bg-transparent" />
        link = <div className={linkClass}><span className="tx-hash" data-hash={item.dest_tx_hash}>{truncateHash(item.dest_tx_hash)}</span></div>
    } else if (item.sn == null) {
        // Hub-intent event (no serial number): single-tx event on the hub with
        // no separate destination leg. Mirror the source tx + chain into the
        // dest column so the row reads symmetrically instead of as a half-empty
        // relay leg. The intent's actual destination chain still shows in
        // action_detail (e.g. "IntentSwap … -> SOL(solana)").
        scanUrl = meta.urls.tx[item.src_network]
        networkImg = <Image alt={item.src_network} src={`/images/network-${helper.REV_NETWORK_MAPPINGS[item.src_network]}.png`} width={24} height={24} className="rounded-full bg-transparent" />
        link = <div className={linkClass}><span className="tx-hash" data-hash={item.src_tx_hash}>{truncateHash(item.src_tx_hash)}</span></div>
    } else {
        networkImg = <Image alt={item.dest_network} src={`/images/network-${helper.REV_NETWORK_MAPPINGS[item.dest_network]}.png`} width={24} height={24} className="rounded-full bg-transparent" />
        link = <div></div>
    }

    return (
        <div className="flex items-center gap-2">
            {networkImg}
            {link}
        </div>
    )
}

function renderHashLink(scanUrl, network, hash, isFull = false) {
    if (!hash) return <div>-</div>

    const isOdHash = typeof hash === 'string' && hash.toLowerCase().startsWith('od')
    let networkImg
    let linkClass = 'hover:underline inline-block'
    let link = <div>-</div>
    let copyButton = <ClipboardDocumentIcon width={20} height={20} className={'opacity-75 text-gray-900 copy-hash cursor-pointer ml-2'} />

    scanUrl = scanUrl ? scanUrl.replace(/\/+$/, '') : ''
    let href = `${scanUrl}/${hash}`
    if (network == '1' || network == '10002') {
        href = scanUrl.replace('{txHash}', hash)
    }
    if (network == '60') {
        const txHash = hash.startsWith('0x') ? hash : `0x${hash}`
        href = `https://explorer.hiro.so/txid/${txHash}?chain=mainnet`
    }
    if (network == '66') {
        // XRP explorer (xrpscan) expects the bare hash; strip a leading 0x if present.
        const txHash = hash.startsWith('0x') ? hash.slice(2) : hash
        href = `${scanUrl}/${txHash}`
    }
    // XRP hashes display (and copy) without the 0x prefix, matching the link.
    const dispHash = network == '66' && typeof hash === 'string' && hash.startsWith('0x') ? hash.slice(2) : hash
    networkImg = <Image alt={network} src={`/images/network-${helper.REV_NETWORK_MAPPINGS[network]}.png`} width={24} height={24} className="rounded-full bg-transparent" />
    link = !isFull || isOdHash ? (
        <div className={linkClass}><span className="tx-hash" data-hash={dispHash}>{isFull ? dispHash : truncateHash(dispHash)}</span></div>
    ) : (
        <div className="flex">
            <Link className={linkClass} href={href} target="_blank">
                <span className="tx-hash" data-hash={dispHash}>{dispHash}</span>
            </Link>
            {copyButton}
        </div>
    )

    return (
        <div className="flex items-center gap-2">
            {networkImg}
            {link}
        </div>
    )
}

export default {
    renderMessageStatus,
    renderHashLink,
    renderDestHashLink,
    renderSerialNo
}
