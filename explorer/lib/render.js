import Link from 'next/link'
import Image from 'next/image'
import CopyButton from '@/components/copy-button'
import helper from "./helper"

// Shorten a hash for list display: first 7 + last 7 chars. The full value is
// still carried in the `data-hash` attribute (used for copy + sibling hover),
// so only the visible label is truncated.
function truncateHash(hash) {
    if (typeof hash !== 'string' || hash.length <= 15) return hash
    return `${hash.slice(0, 7)}…${hash.slice(-7)}`
}

// Status pill: brand tokens only (no stock green/blue/amber, yellow is never a
// surface). Sentence-case label with a leading status dot. Pill text contrast is
// >= 4.5:1 for every entry (espresso/clay-dark/error-dark on their backgrounds).
// executed -> success, failed/rollbacked -> error, the rest -> neutral cream/clay
// with a distinct dot so they stay distinguishable.
const STATUS_PILLS = {
    executed: { pill: 'bg-success-base text-espresso', dot: 'bg-success' },
    failed: { pill: 'bg-error-base text-error-dark', dot: 'bg-error' },
    rollbacked: { pill: 'bg-error-lighter text-error-dark', dot: 'bg-error-dark' },
    delivered: { pill: 'bg-light-cream text-espresso', dot: 'bg-espresso' },
    // `attested` is the one new MPC status (R4). `routed`/`hub-burned`/`minted`/
    // `swept`/`released` are NOT status values (detail-timeline legs only).
    attested: { pill: 'bg-cream-cherry text-espresso', dot: 'bg-cherry-soda' },
    pending: { pill: 'bg-almost-white text-clay-dark !border-cherry-grey', dot: 'bg-transparent border border-clay' }
}
// Total fallback (R4): unknown/undefined/null status renders a generic badge
// rather than returning undefined (which produced a blank pill).
const STATUS_PILL_FALLBACK = { pill: 'bg-cream-white text-clay-dark', dot: 'bg-clay-light' }

function renderMessageStatus(status) {
    const base = 'inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-full py-1 px-2.5 min-w-24 whitespace-nowrap border border-transparent'
    const s = (status || '').toLowerCase()
    const { pill, dot } = STATUS_PILLS[s] || STATUS_PILL_FALLBACK
    const label = s || 'unknown'
    return (
        <span className={`${base} ${pill}`}>
            <span aria-hidden="true" className={`inline-block w-1.5 h-1.5 rounded-full ${dot}`}></span>
            {label.charAt(0).toUpperCase() + label.slice(1)}
        </span>
    )
}

// Serial-No cell shared by the message list and the MPC detail timeline. An MPC
// row (chain-based detection) shows an "MPC" badge — completed MPC rows carry
// status `executed` and are otherwise indistinguishable from legacy rows in the
// list. Legacy rows are unchanged: a present sn shows the number, a NULL sn keeps
// the "hub-only" badge.
function renderSerialNo(item) {
    const badge = (label) => (
        <span className="inline-block whitespace-nowrap text-xs font-medium rounded-full px-2 py-0.5 bg-cream-white text-clay-dark">{label}</span>
    )
    if (helper.isMpcTransaction(item)) return badge('MPC')
    if (helper.isSolverMarketPlaceFill(item)) return badge('Marketplace')
    if (item.sn == null) return badge('hub-only')
    return item.sn
}

// Chain icon + name with no tx hash, for rows that carry a chain but no tx
// (SolverMarketPlaceFills: src = chain of the user's input leg, dest = output leg).
function renderChain(network) {
    const name = helper.REV_NETWORK_MAPPINGS[network]
    if (!name) return <div>-</div>
    return (
        <div className="flex items-center gap-2">
            <Image alt="" src={`/images/network-${name}.png`} width={24} height={24} className="rounded-full bg-transparent" />
            <span className="capitalize">{String(name)}</span>
        </div>
    )
}

function renderSrcHashLink(item, meta) {
    if (helper.isSolverMarketPlaceFill(item)) return renderChain(item.src_network)
    return renderHashLink(meta?.urls.tx[item.src_network], item.src_network, item.src_tx_hash)
}

function renderDestHashLink(item, meta) {
    if (helper.isSolverMarketPlaceFill(item)) return renderChain(item.dest_network)

    let scanUrl
    let networkImg
    let linkClass = 'hover:underline inline-block'
    let link
    if (item.rollback_tx_hash) {
        scanUrl = meta.urls.tx[item.src_network]
        networkImg = (
            <div className="w-[3rem]">
                <Image className="relative inline-block" alt={helper.REV_NETWORK_MAPPINGS[item.dest_network] || ""} src={`/images/network-${item.dest_network}.png`} width={24} height={24} />
                <Image
                    className="relative inline-block -left-4 rounded-full bg-white"
                    alt={helper.REV_NETWORK_MAPPINGS[item.src_network] || ""}
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
        networkImg = <Image alt={helper.REV_NETWORK_MAPPINGS[item.dest_network] || ""} src={`/images/network-${helper.REV_NETWORK_MAPPINGS[item.dest_network]}.png`} width={24} height={24} className="rounded-full bg-transparent" />
        link = <div className={linkClass}><span className="tx-hash" data-hash={item.dest_tx_hash}>{truncateHash(item.dest_tx_hash)}</span></div>
    } else if (item.sn == null && !helper.isMpcTransaction(item)) {
        // Hub-intent event (no serial number): single-tx event on the hub with
        // no separate destination leg. Mirror the source tx + chain into the
        // dest column so the row reads symmetrically instead of as a half-empty
        // relay leg. The intent's actual destination chain still shows in
        // action_detail (e.g. "IntentSwap … -> SOL(solana)").
        // MPC rows (also sn == null) are excluded: an in-progress MPC tx has no
        // dest tx yet and must NOT masquerade the source tx as the destination.
        // SolverMarketPlaceFills return early above: they have no tx hash to mirror.
        scanUrl = meta.urls.tx[item.src_network]
        networkImg = <Image alt={helper.REV_NETWORK_MAPPINGS[item.src_network] || ""} src={`/images/network-${helper.REV_NETWORK_MAPPINGS[item.src_network]}.png`} width={24} height={24} className="rounded-full bg-transparent" />
        link = <div className={linkClass}><span className="tx-hash" data-hash={item.src_tx_hash}>{truncateHash(item.src_tx_hash)}</span></div>
    } else {
        networkImg = <Image alt={helper.REV_NETWORK_MAPPINGS[item.dest_network] || ""} src={`/images/network-${helper.REV_NETWORK_MAPPINGS[item.dest_network]}.png`} width={24} height={24} className="rounded-full bg-transparent" />
        link = <div></div>
    }

    return (
        <div className="flex items-center gap-2">
            {networkImg}
            {link}
        </div>
    )
}

// Hash shown under the destination network in the Route cell (null when none).
// Mirrors renderDestHashLink: rollback tx, else dest tx, else (hub-intent event,
// non-MPC, no sn) the source tx mirrored. SolverMarketPlaceFills carry no hash.
function routeDestHash(item) {
    if (helper.isSolverMarketPlaceFill(item)) return null
    if (item.rollback_tx_hash) return item.rollback_tx_hash
    if (item.dest_tx_hash) return item.dest_tx_hash
    if (item.sn == null && !helper.isMpcTransaction(item)) return item.src_tx_hash || null
    return null
}

// One end of the desktop Route cell: network icon, then network name (same size
// and weight whether or not a hash exists) with the short hash as a quieter
// second line only when present. Always vertically centred.
function routeLeg(network, hash) {
    const name = helper.REV_NETWORK_MAPPINGS[network]
    if (!name) return <div className="text-sm text-clay-dark">-</div>
    return (
        <div className="flex items-center gap-2 min-w-0">
            <Image alt="" src={`/images/network-${name}.png`} width={24} height={24} className="rounded-full bg-transparent shrink-0" />
            <div className="min-w-0">
                <div className="text-sm font-medium capitalize text-espresso leading-5">{String(name)}</div>
                {hash && (
                    <div className="text-xs text-clay-dark leading-4">
                        <span className="tx-hash" data-hash={hash}>{truncateHash(hash)}</span>
                    </div>
                )}
            </div>
        </div>
    )
}

// Route cell: source -> destination in one column.
function renderRoute(item) {
    const fill = helper.isSolverMarketPlaceFill(item)
    return (
        <div className="flex items-center gap-2 xl:gap-3 min-w-0">
            {routeLeg(item.src_network, fill ? null : item.src_tx_hash)}
            <span aria-hidden="true" className="text-clay-dark shrink-0 leading-none">&rarr;</span>
            {routeLeg(item.dest_network, routeDestHash(item))}
        </div>
    )
}

// Chains whose native tx hash has no 0x prefix: XRP (66), Cardano (1815).
const BARE_HASH_NETWORKS = new Set(['66', '1815'])

function renderHashLink(scanUrl, network, hash, isFull = false) {
    if (!hash) return <div>-</div>

    const isOdHash = typeof hash === 'string' && hash.toLowerCase().startsWith('od')
    let networkImg
    let linkClass = 'hover:underline inline-block'
    let link = <div>-</div>

    scanUrl = scanUrl ? scanUrl.replace(/\/+$/, '') : ''
    let href = `${scanUrl}/${hash}`
    if (network == '1' || network == '10002') {
        href = scanUrl.replace('{txHash}', hash)
    }
    if (network == '60') {
        const txHash = hash.startsWith('0x') ? hash : `0x${hash}`
        href = `https://explorer.hiro.so/txid/${txHash}?chain=mainnet`
    }
    const isBareHash = BARE_HASH_NETWORKS.has(String(network))
    if (isBareHash) {
        // These explorers (xrpscan, cardanoscan) expect the bare hash; strip a leading 0x if present.
        const txHash = hash.startsWith('0x') ? hash.slice(2) : hash
        href = `${scanUrl}/${txHash}`
    }
    // Bare-hash chains display (and copy) without the 0x prefix, matching the link.
    const dispHash = isBareHash && typeof hash === 'string' && hash.startsWith('0x') ? hash.slice(2) : hash
    networkImg = <Image alt={helper.REV_NETWORK_MAPPINGS[network] || ""} src={`/images/network-${helper.REV_NETWORK_MAPPINGS[network]}.png`} width={24} height={24} className="rounded-full bg-transparent" />
    link = !isFull || isOdHash ? (
        <div className={linkClass}><span className="tx-hash" data-hash={dispHash}>{isFull ? dispHash : truncateHash(dispHash)}</span></div>
    ) : (
        <div className="flex items-center gap-1 max-md:min-w-0">
            <Link className={`${linkClass} max-md:min-w-0 max-md:break-all`} href={href} target="_blank">
                <span className="tx-hash" data-hash={dispHash}>{dispHash}</span>
            </Link>
            <CopyButton value={dispHash} />
        </div>
    )

    return (
        <div className="flex items-center gap-2 min-w-0">
            {networkImg}
            {link}
        </div>
    )
}

export default {
    renderMessageStatus,
    renderHashLink,
    renderSrcHashLink,
    renderDestHashLink,
    renderRoute,
    renderSerialNo,
    renderChain
}
