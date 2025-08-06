import Link from 'next/link'
import Image from 'next/image'
import { ClipboardDocumentIcon } from '@heroicons/react/24/solid'
import helper from "./helper"

function renderMessageStatus(status) {
    if (status.toLowerCase() == 'failed') return <span className="uppercase text-xs rounded-2xl p-1 inline-block w-24 bg-red-600 text-neutral-50 text-center">{status}</span>
    if (status.toLowerCase() == 'rollbacked') return <span className="uppercase text-xs rounded-2xl p-1 inline-block w-24 bg-red-300 text-center">{status}</span>
    if (status.toLowerCase() == 'pending') return <span className="uppercase text-xs rounded-2xl p-1 inline-block w-24 bg-gray-300 text-center">{status}</span>
    if (status.toLowerCase() == 'executed') return <span className="uppercase text-xs rounded-2xl p-1 inline-block w-24 bg-green-300 text-center">{status}</span>
    if (status.toLowerCase() == 'delivered') return <span className="uppercase text-xs rounded-2xl p-1 inline-block w-24 bg-blue-300 text-center">{status}</span>
}

function renderDestHashLink(item, meta) {
    let scanUrl
    let networkImg
    let linkClass = 'hover:underline inline-block text-ellipsis overflow-hidden w-64'
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
        link = <div className={linkClass}>{item.rollback_tx_hash}</div>
    } else if (item.dest_tx_hash) {
        scanUrl = meta.urls.tx[item.dest_network]
        networkImg = <Image alt={item.dest_network} src={`/images/network-${helper.REV_NETWORK_MAPPINGS[item.dest_network]}.png`} width={24} height={24} className="rounded-full bg-transparent" />
        link = <div className={linkClass}>{item.dest_tx_hash}</div>
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

    let networkImg
    let linkClass = isFull ? 'hover:underline inline-block' : 'hover:underline inline-block text-ellipsis overflow-hidden w-64'
    let link = <div>-</div>
    let copyButton = <ClipboardDocumentIcon width={20} height={20} className={'opacity-75 text-gray-900 copy-hash cursor-pointer ml-2'} />

    scanUrl = scanUrl ? scanUrl.replace(/\/+$/, '') : ''
    let href = `${scanUrl}/${hash}`
    if (network == '1' || network == '10002') {
        href = scanUrl.replace('{txHash}', hash)
    }
    networkImg = <Image alt={network} src={`/images/network-${helper.REV_NETWORK_MAPPINGS[network]}.png`} width={24} height={24} className="rounded-full bg-transparent" />
    link = !isFull ? (
        <div className={linkClass}>{hash}</div>
    ) : (
        <div className="flex">
            <Link className={linkClass} href={href} target="_blank">
                {hash}
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

function renderActionType(action){
    switch (action) {
        case 'transfer':
            return 'Transfer';

        case 'deposit':
            return 'Deposit';

        case 'supply':
            return 'Supply';

        case 'borrow':
            return 'Borrow';

        case 'withdraw':
            return 'Withdraw';

        case 'repay':
            return 'Repay';

        case 'createIntent':
            return 'Create Intent';

        case 'cancelIntent':
            return 'Cancel Intent';

        default:
            return 'SendMsg'
    }
}

export default {
    renderMessageStatus,
    renderHashLink,
    renderDestHashLink,
    renderActionType
}
