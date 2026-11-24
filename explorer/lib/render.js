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

// Rollback cue: the rollback tx lives on the SOURCE chain (the refund), so it is
// never shown as the destination's hash. Instead a small source-chain icon marks
// the row as rolled back (the old list overlaid the src icon on the dest icon).
function rollbackMarker(item) {
    if (!item.rollback_tx_hash) return null
    const srcName = helper.REV_NETWORK_MAPPINGS[item.src_network]
    const title = `Rolled back on ${srcName || 'the source chain'}`
    return (
        <span className="inline-flex items-center shrink-0" title={title}>
            {srcName && <Image alt="" src={`/images/network-${srcName}.png`} width={14} height={14} className="rounded-full bg-white ring-1 ring-white" />}
            <span className="sr-only">{title}</span>
        </span>
    )
}

// Destination leg for the mobile cards. The hash shown is only ever the dest
// chain's own dest_tx_hash; hub events (sn == null) and rollbacks have no dest
// tx, so they show the dest chain alone (never another chain's hash under it).
function renderDestHashLink(item, meta) {
    if (helper.isSolverMarketPlaceFill(item)) return renderChain(item.dest_network)

    const name = helper.REV_NETWORK_MAPPINGS[item.dest_network]
    const marker = rollbackMarker(item)
    let leg
    if (item.dest_tx_hash && name) {
        leg = (
            <div className="flex items-center gap-2">
                <Image alt={String(name)} src={`/images/network-${name}.png`} width={24} height={24} className="rounded-full bg-transparent" />
                <div className="hover:underline inline-block"><span className="tx-hash" data-hash={item.dest_tx_hash}>{truncateHash(item.dest_tx_hash)}</span></div>
            </div>
        )
    } else if (item.dest_tx_hash) {
        leg = <div className="hover:underline inline-block"><span className="tx-hash" data-hash={item.dest_tx_hash}>{truncateHash(item.dest_tx_hash)}</span></div>
    } else if (name) {
        leg = renderChain(item.dest_network)
    } else {
        leg = <div className="text-clay-dark">-</div>
    }
    if (!marker) return leg
    return <div className="flex items-center gap-1">{leg}{marker}</div>
}

// Hash shown under the destination network in the Route cell (null when none).
// Only the destination chain's own dest_tx_hash qualifies: hub events (sn ==
// null) have no dest tx and rollback txs live on the source chain, so neither is
// ever attributed to the destination network. Exported for tests.
function routeDestHash(item) {
    if (helper.isSolverMarketPlaceFill(item)) return null
    return item.dest_tx_hash || null
}

// One end of the desktop Route cell: network icon, then network name (same size
// and weight whether or not a hash exists) with the short hash as a quieter
// second line only when present. Always vertically centred.
function routeLeg(network, hash, marker = null) {
    const name = helper.REV_NETWORK_MAPPINGS[network]
    // Bare-hash chains (XRP, Cardano) display without 0x, as on the detail page.
    const shown = BARE_HASH_NETWORKS.has(String(network)) && typeof hash === 'string' && hash.startsWith('0x') ? hash.slice(2) : hash
    const hashLine = shown && (
        <div className="text-xs text-clay-dark leading-4">
            <span className="tx-hash" data-hash={shown}>{truncateHash(shown)}</span>
        </div>
    )
    if (!name) {
        // Unknown network: still show the hash (it is this leg's own), labelled generically.
        if (!hashLine && network == null) return <div className="text-sm text-clay-dark">-</div>
        return (
            <div className="min-w-0">
                <div className="text-sm font-medium text-espresso leading-5">{network == null ? 'Unknown chain' : `Chain ${network}`}</div>
                {hashLine}
            </div>
        )
    }
    return (
        <div className="flex items-center gap-2 min-w-0">
            <Image alt="" src={`/images/network-${name}.png`} width={24} height={24} className="rounded-full bg-transparent shrink-0" />
            <div className="min-w-0">
                <div className="text-sm font-medium capitalize text-espresso leading-5 flex items-center gap-1">{String(name)}{marker}</div>
                {hashLine}
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
            {routeLeg(item.dest_network, routeDestHash(item), rollbackMarker(item))}
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
    routeDestHash,
    renderSerialNo,
    renderChain
}
