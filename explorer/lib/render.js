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
    if (status.toLowerCase() == 'failed') return <span className={`${base} bg-cherry text-white`}>{status}</span>
    if (status.toLowerCase() == 'rollbacked') return <span className={`${base} bg-soda-bright text-espresso`}>{status}</span>
    if (status.toLowerCase() == 'pending') return <span className={`${base} bg-cherry-grey text-espresso`}>{status}</span>
    if (status.toLowerCase() == 'executed') return <span className={`${base} bg-green-200 text-green-900`}>{status}</span>
    if (status.toLowerCase() == 'delivered') return <span className={`${base} bg-blue-200 text-blue-900`}>{status}</span>
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
    networkImg = <Image alt={network} src={`/images/network-${helper.REV_NETWORK_MAPPINGS[network]}.png`} width={24} height={24} className="rounded-full bg-transparent" />
    link = !isFull || isOdHash ? (
        <div className={linkClass}><span className="tx-hash" data-hash={hash}>{isFull ? hash : truncateHash(hash)}</span></div>
    ) : (
        <div className="flex">
            <Link className={linkClass} href={href} target="_blank">
                <span className="tx-hash" data-hash={hash}>{hash}</span>
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
    renderDestHashLink
}
