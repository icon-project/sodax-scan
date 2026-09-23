
const TestnetDeployment = require('../configs/testnet_deployment.json')
const MainnetDeployment = require('../configs/mainnet_deployment.json')
const USE_MAINNET = process.env.USE_MAINNET == 'true'
const CONFIG_NETWORKS = USE_MAINNET ? MainnetDeployment.networks : TestnetDeployment.networks

const NETWORK = {
    AVAX: 'avax',
    SUI: 'sui',
    NEAR: 'near',
    SONIC: 'sonic',
    ICON: 'icon',
    INJECTIVE: 'injective',
    STELLAR: 'stellar',
    SOLANA: 'solana',
    STACKS: 'stacks',
    BASE: 'base',
    OPTIMISM: 'optimism',
    POLYGON: 'polygon',
    ARBITRUM: 'arbitrum',
    BSC: 'bsc',
    NIBIRU: 'nibiru',
    HYPERLIQUID: 'hyperliquid',
    LIGHTLINK: 'lightlink',
    ETHEREUM: 'ethereum',
    REDBELLY: 'redbelly',
    KAIA: 'kaia',
    BITCOIN: 'bitcoin',
    ALEO: 'aleo',
    HEDERA: 'hedera',
    ROBINHOOD: 'robinhood',
    MONAD: 'monad',
    XRP: 'xrp',
    ZCASH: 'zcash',
    TON: 'ton',
    TRON: 'tron',
}

const NETWORK_MAPPINGS = {
    [NETWORK.SUI]: CONFIG_NETWORKS.sui.nid,
    [NETWORK.AVAX]: CONFIG_NETWORKS.avax.nid,
    [NETWORK.NEAR]: CONFIG_NETWORKS.near.nid,
    [NETWORK.SONIC]: CONFIG_NETWORKS.sonic.nid,
    [NETWORK.ICON]: CONFIG_NETWORKS.icon.nid,
    [NETWORK.INJECTIVE]: CONFIG_NETWORKS.injective.nid,
    [NETWORK.STELLAR]: CONFIG_NETWORKS.stellar.nid,
    [NETWORK.SOLANA]: CONFIG_NETWORKS.solana.nid,
    [NETWORK.STACKS]: CONFIG_NETWORKS.stacks.nid,
    [NETWORK.BASE]: CONFIG_NETWORKS.base.nid,
    [NETWORK.OPTIMISM]: CONFIG_NETWORKS.optimism.nid,
    [NETWORK.POLYGON]: CONFIG_NETWORKS.polygon.nid,
    [NETWORK.ARBITRUM]: CONFIG_NETWORKS.arbitrum.nid,
    [NETWORK.BSC]: CONFIG_NETWORKS.bsc.nid,
    [NETWORK.NIBIRU]: CONFIG_NETWORKS.nibiru.nid,
    [NETWORK.HYPERLIQUID]: CONFIG_NETWORKS.hyperliquid.nid,
    [NETWORK.LIGHTLINK]: CONFIG_NETWORKS.lightlink.nid,
    [NETWORK.ETHEREUM]: CONFIG_NETWORKS.ethereum.nid,
    [NETWORK.REDBELLY]: CONFIG_NETWORKS.redbelly.nid,
    [NETWORK.KAIA]: CONFIG_NETWORKS.kaia.nid,
    [NETWORK.BITCOIN]: CONFIG_NETWORKS.bitcoin.nid,
    [NETWORK.ALEO]: CONFIG_NETWORKS.aleo.nid,
    [NETWORK.HEDERA]: CONFIG_NETWORKS.hedera.nid,
    [NETWORK.ROBINHOOD]: CONFIG_NETWORKS.robinhood.nid,
    [NETWORK.MONAD]: CONFIG_NETWORKS.monad.nid,
    [NETWORK.XRP]: CONFIG_NETWORKS.xrp.nid,
    [NETWORK.ZCASH]: CONFIG_NETWORKS.zcash.nid,
    [NETWORK.TON]: CONFIG_NETWORKS.ton.nid,
    [NETWORK.TRON]: CONFIG_NETWORKS.tron.nid,
}

const REV_NETWORK_MAPPINGS = {
    [CONFIG_NETWORKS.sui.nid]: [NETWORK.SUI],
    [CONFIG_NETWORKS.avax.nid]: [NETWORK.AVAX],
    [CONFIG_NETWORKS.near.nid]: [NETWORK.NEAR],
    [CONFIG_NETWORKS.sonic.nid]: [NETWORK.SONIC],
    [CONFIG_NETWORKS.icon.nid]: [NETWORK.ICON],
    [CONFIG_NETWORKS.injective.nid]: [NETWORK.INJECTIVE],
    [CONFIG_NETWORKS.stellar.nid]: [NETWORK.STELLAR],
    [CONFIG_NETWORKS.solana.nid]: [NETWORK.SOLANA],
    [CONFIG_NETWORKS.stacks.nid]: [NETWORK.STACKS],
    [CONFIG_NETWORKS.base.nid]: [NETWORK.BASE],
    [CONFIG_NETWORKS.optimism.nid]: [NETWORK.OPTIMISM],
    [CONFIG_NETWORKS.polygon.nid]: [NETWORK.POLYGON],
    [CONFIG_NETWORKS.arbitrum.nid]: [NETWORK.ARBITRUM],
    [CONFIG_NETWORKS.bsc.nid]: [NETWORK.BSC],
    [CONFIG_NETWORKS.nibiru.nid]: [NETWORK.NIBIRU],
    [CONFIG_NETWORKS.hyperliquid.nid]: [NETWORK.HYPERLIQUID],
    [CONFIG_NETWORKS.lightlink.nid]: [NETWORK.LIGHTLINK],
    [CONFIG_NETWORKS.ethereum.nid]: [NETWORK.ETHEREUM],
    [CONFIG_NETWORKS.redbelly.nid]: [NETWORK.REDBELLY],
    [CONFIG_NETWORKS.kaia.nid]: [NETWORK.KAIA],
    [CONFIG_NETWORKS.bitcoin.nid]: [NETWORK.BITCOIN],
    [CONFIG_NETWORKS.aleo.nid]: [NETWORK.ALEO],
    [CONFIG_NETWORKS.hedera.nid]: [NETWORK.HEDERA],
    [CONFIG_NETWORKS.robinhood.nid]: [NETWORK.ROBINHOOD],
    [CONFIG_NETWORKS.monad.nid]: [NETWORK.MONAD],
    [CONFIG_NETWORKS.xrp.nid]: [NETWORK.XRP],
    [CONFIG_NETWORKS.zcash.nid]: [NETWORK.ZCASH],
    [CONFIG_NETWORKS.ton.nid]: [NETWORK.TON],
    [CONFIG_NETWORKS.tron.nid]: [NETWORK.TRON],
}

const NETWORK_DETAILS = {
    [NETWORK.AVAX]: {
        id: NETWORK.AVAX,
        name: 'Avax',
        logo: `/images/network-avax.png`,
        nativeAsset: 'AVAX',
    },
    [NETWORK.SUI]: {
        id: NETWORK.SUI,
        name: 'Sui',
        logo: `/images/network-sui.png`,
        nativeAsset: 'SUI',
    },
    [NETWORK.NEAR]: {
        id: NETWORK.NEAR,
        name: 'Near',
        logo: `/images/network-near.png`,
        nativeAsset: 'NEAR',
    },
    [NETWORK.SONIC]: {
        id: NETWORK.SONIC,
        name: 'Sonic',
        logo: `/images/network-sonic.png`,
        nativeAsset: 'Sonic',
    },
    [NETWORK.ICON]: {
        id: NETWORK.ICON,
        name: 'Icon',
        logo: `/images/network-icon.png`,
        nativeAsset: 'ICX',
    },
    [NETWORK.INJECTIVE]: {
        id: NETWORK.INJECTIVE,
        name: 'Injective',
        logo: `/images/network-injective.png`,
        nativeAsset: 'INJ',
    },
    [NETWORK.STELLAR]: {
        id: NETWORK.STELLAR,
        name: 'stellar',
        logo: `/images/network-stellar.png`,
        nativeAsset: 'XLM',
    },
    [NETWORK.SOLANA]: {
        id: NETWORK.SOLANA,
        name: 'solana',
        logo: `/images/network-solana.png`,
        nativeAsset: 'SOL',
    },
    [NETWORK.STACKS]: {
        id: NETWORK.STACKS,
        name: 'stacks',
        logo: `/images/network-stacks.png`,
        nativeAsset: 'STX',
    },
    [NETWORK.BASE]: {
        id: NETWORK.BASE,
        name: 'base',
        logo: `/images/network-base.png`,
        nativeAsset: 'ETH',
    },
    [NETWORK.ARBITRUM]: {
        id: NETWORK.ARBITRUM,
        name: 'arbitrum',
        logo: `/images/network-arbitrum.png`,
        nativeAsset: 'ETH',
    },
    [NETWORK.POLYGON]: {
        id: NETWORK.POLYGON,
        name: 'polygon',
        logo: `/images/network-polygon.png`,
        nativeAsset: 'POL',
    },
    [NETWORK.OPTIMISM]: {
        id: NETWORK.OPTIMISM,
        name: 'optimism',
        logo: `/images/network-optimism.png`,
        nativeAsset: 'ETH',
    },
    [NETWORK.BSC]: {
        id: NETWORK.BSC,
        name: 'bsc',
        logo: `/images/network-bsc.png`,
        nativeAsset: 'ETH',
    },
    [NETWORK.NIBIRU]: {
        id: NETWORK.NIBIRU,
        name: 'nibiru',
        logo: `/images/network-nibiru.png`,
        nativeAsset: 'NIBI',
    },
    [NETWORK.HYPERLIQUID]: {
        id: NETWORK.HYPERLIQUID,
        name: 'hyperliquid',
        logo: `/images/network-hyperliquid.png`,
        nativeAsset: 'HYPE',
    },
    [NETWORK.LIGHTLINK]: {
        id: NETWORK.LIGHTLINK,
        name: 'lightlink',
        logo: `/images/network-lightlink.png`,
        nativeAsset: 'ETH',
    },
    [NETWORK.ETHEREUM]: {
        id: NETWORK.ETHEREUM,
        name: 'ethereum',
        logo: `/images/network-ethereum.png`,
        nativeAsset: 'ETH',
    },
    [NETWORK.REDBELLY]: {
        id: NETWORK.REDBELLY,
        name: 'redbelly',
        logo: `/images/network-redbelly.png`,
        nativeAsset: 'RBNT',
    },
    [NETWORK.KAIA]: {
        id: NETWORK.KAIA,
        name: 'kaia',
        logo: `/images/network-kaia.png`,
        nativeAsset: 'KAIA',
    },
    [NETWORK.BITCOIN]: {
        id: NETWORK.BITCOIN,
        name: 'bitcoin',
        logo: `/images/network-bitcoin.png`,
        nativeAsset: 'BTC',
    },
    [NETWORK.ALEO]: {
        id: NETWORK.ALEO,
        name: 'aleo',
        logo: `/images/network-aleo.png`,
        nativeAsset: 'ALEO',
    },
    [NETWORK.HEDERA]: {
        id: NETWORK.HEDERA,
        name: 'hedera',
        logo: `/images/network-hedera.svg`,
        nativeAsset: 'HBAR',
    },
    [NETWORK.ROBINHOOD]: {
        id: NETWORK.ROBINHOOD,
        name: 'robinhood',
        logo: `/images/network-robinhood.png`,
        nativeAsset: 'ETH',
    },
    [NETWORK.MONAD]: {
        id: NETWORK.MONAD,
        name: 'monad',
        logo: `/images/network-monad.png`,
        nativeAsset: 'MON',
    },
    [NETWORK.XRP]: {
        id: NETWORK.XRP,
        name: 'xrp',
        logo: `/images/network-xrp.png`,
        nativeAsset: 'XRP',
    },
    [NETWORK.ZCASH]: {
        id: NETWORK.ZCASH,
        name: 'zcash',
        logo: `/images/network-zcash.png`,
        nativeAsset: 'ZEC',
    },
    [NETWORK.TON]: {
        id: NETWORK.TON,
        name: 'ton',
        logo: `/images/network-ton.png`,
        nativeAsset: 'TON',
    },
    [NETWORK.TRON]: {
        id: NETWORK.TRON,
        name: 'tron',
        logo: `/images/network-tron.png`,
        nativeAsset: 'TRX',
    },
}

const MSG_ACTION_TYPES = {
    SendMsg: 'SendMsg',
    Transfer: 'Transfer',
    Borrow: 'Borrow',
    Supply: 'Supply',
    Deposit: 'Deposit',
    Withdraw: 'Withdraw',
    CreateIntent: 'CreateIntent',
    CancelIntent: 'CancelIntent',
    IntentFilled: 'IntentFilled',
    Migration: 'Migration',
    Reverted: 'Reverted',
}

// Static per-chain lifecycle mode (R8). Single source of truth for mode — call
// sites resolve through getChainMode, no mode literal is hardcoded elsewhere.
// sweep: mints then sweeps to the user (terminal = swept).
// memo:  mint is the delivery, no sweep leg (terminal = minted).
const CHAIN_MODE = {
    [NETWORK.MONAD]: 'sweep',
    [NETWORK.ZCASH]: 'sweep',
    [NETWORK.TON]: 'memo',
    [NETWORK.TRON]: 'memo',
    [NETWORK.XRP]: 'memo',
}

// Resolve a numeric chain id (as stored in *_network) to its lifecycle mode.
// Returns 'sweep' | 'memo' | undefined (chain not in the map).
const getChainMode = (networkId) => {
    const name = REV_NETWORK_MAPPINGS[networkId]
    return name ? CHAIN_MODE[name] : undefined
}

// MPC chain set — single source of truth = the CHAIN_MODE keys, resolved to their
// numeric ids ({48,133,607,728126428,66} as strings). Detection is by CHAIN
// involvement (ADR-002 revised): a row is MPC iff its src_network OR dest_network
// is an MPC chain. A completed MPC flow carries the legacy status `executed`, so
// status can NOT detect it — chain involvement is invariant across the lifecycle.
const MPC_CHAIN_IDS = new Set(Object.keys(CHAIN_MODE).map((name) => String(NETWORK_MAPPINGS[name])))

// Attestation is always recorded on NEAR — the attested timeline step is fixed to
// this id (single source), independent of the per-row attested_network column.
const NEAR_NETWORK_ID = NETWORK_MAPPINGS[NETWORK.NEAR]
const isMpcChain = (networkId) => networkId != null && MPC_CHAIN_IDS.has(String(networkId))
const isMpcTransaction = (row) => !!row && (isMpcChain(row.src_network) || isMpcChain(row.dest_network))

// Shared status-filter list — one source feeding the filter dropdown
// (message-filter.tsx) and the pills (renderMessageStatus) so they never drift
// (R2b, §2.7). Only `attested` is genuinely new; the other five are existing
// legacy statuses. `routed`/`hub-burned`/`minted`/`swept`/`released` are NOT
// status values — they survive only as detail-timeline legs (R5). MPC detection is
// chain-based (isMpcTransaction), independent of this list.
const STATUS_FILTERS = ['pending', 'attested', 'delivered', 'executed', 'failed', 'rollbacked']

// Normalise action_type to the MPC kind; fall back to leg inference (ADR-006) when
// action_type is missing or an unrecognised label: hub_burn present ⇒ withdrawal,
// else release present ⇒ transfer, else deposit.
const mpcKindOf = (row) => {
    const t = (row.action_type || '').toLowerCase()
    if (t === 'deposit' || t === 'withdrawal' || t === 'transfer') return t
    if (row.hub_burn_tx_hash != null) return 'withdrawal'
    if (row.release_tx_hash != null) return 'transfer'
    return 'deposit'
}

// Pure, kind-aware step-derivation for the MPC timeline (R5, R6, ADR-006). Returns
// the post-Source legs in lifecycle order for the row's kind plus the resolved
// terminal ('Source' = src_* is rendered by the component as step 0). Only the legs
// a kind uses are emitted. Terminal: deposit → getChainMode(dest_network)
// (sweep⇒swept shown & emphasised / memo⇒swept omitted, minted emphasised, M4);
// withdrawal & transfer → released (kind-driven, no mode lookup).
const deriveMpcSteps = (row) => {
    const kind = mpcKindOf(row)
    // Attestation always happens on NEAR — the attested step's chain/icon/explorer
    // link is fixed to NEAR (single source: NETWORK_MAPPINGS.near), never derived
    // from the per-row attested_network column.
    const attested = { key: 'attested', label: 'Attested', network: NEAR_NETWORK_ID, hash: row.attested_tx_hash }
    const minted = { key: 'minted', label: 'Minted', network: row.mint_network, hash: row.mint_tx_hash }
    const swept = { key: 'swept', label: 'Swept', network: row.sweep_network, hash: row.sweep_tx_hash }
    // The release leg's chain id may arrive suffixed (e.g. "66-0"); use the base id
    // for icon + explorer-URL resolution.
    const releaseNetwork = row.release_network != null ? String(row.release_network).split('-')[0] : row.release_network
    const released = { key: 'released', label: 'Released', network: releaseNetwork, hash: row.release_tx_hash }

    let mode
    let rawSteps
    let terminalKey
    if (kind === 'withdrawal') {
        rawSteps = [attested, released]
        terminalKey = 'released'
    } else if (kind === 'transfer') {
        rawSteps = [attested, released]
        terminalKey = 'released'
    } else {
        mode = getChainMode(row.dest_network)
        if (mode === 'memo') {
            rawSteps = [attested, minted]
            terminalKey = 'minted'
        } else if (mode === 'sweep') {
            rawSteps = [attested, minted, swept]
            terminalKey = 'swept'
        } else {
            // deposit on a chain not in the mode map: show swept only if reached
            const hasSweep = row.sweep_tx_hash != null
            rawSteps = hasSweep ? [attested, minted, swept] : [attested, minted]
            terminalKey = hasSweep ? 'swept' : 'minted'
        }
    }

    const steps = rawSteps.map((step) => ({
        ...step,
        reached: step.hash != null,
        terminal: step.key === terminalKey,
    }))

    return { kind, mode, steps, terminalKey }
}

const getNativeAsset = (network) => {
    return NETWORK_DETAILS[REV_NETWORK_MAPPINGS[network]].nativeAsset
}

const getNetworks = () => {
    return Object.values(NETWORK_DETAILS)
}

const getMsgTypes = () => {
    return Object.values(MSG_ACTION_TYPES)
}

export default {
    getNativeAsset,
    getNetworks,
    getMsgTypes,
    REV_NETWORK_MAPPINGS,
    NETWORK_MAPPINGS,
    CHAIN_MODE,
    getChainMode,
    MPC_CHAIN_IDS,
    isMpcChain,
    isMpcTransaction,
    STATUS_FILTERS,
    deriveMpcSteps,
}
