
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
    ARCHWAY: 'archway',
    STACKS: 'stacks',
    BASE: 'base',
    OPTIMISM: 'optimism',
    POLYGON: 'polygon',
    ARBITRUM: 'arbitrum',
    BSC: 'bsc',
    NIBIRU: 'nibiru',
    HYPERLIQUID: 'hyperliquid',
    BOTANIX: 'botanix',
    LIGHTLINK: 'lightlink',
    ETHEREUM: 'ethereum',
    REDBELLY: 'redbelly',

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
    [NETWORK.ARCHWAY]: CONFIG_NETWORKS.archway.nid,
    [NETWORK.STACKS]: CONFIG_NETWORKS.stacks.nid,
    [NETWORK.BASE]: CONFIG_NETWORKS.base.nid,
    [NETWORK.OPTIMISM]: CONFIG_NETWORKS.optimism.nid,
    [NETWORK.POLYGON]: CONFIG_NETWORKS.polygon.nid,
    [NETWORK.ARBITRUM]: CONFIG_NETWORKS.arbitrum.nid,
    [NETWORK.BSC]: CONFIG_NETWORKS.bsc.nid,
    [NETWORK.NIBIRU]: CONFIG_NETWORKS.nibiru.nid,
    [NETWORK.HYPERLIQUID]: CONFIG_NETWORKS.hyperliquid.nid,
    [NETWORK.BOTANIX]: CONFIG_NETWORKS.botanix.nid,
    [NETWORK.LIGHTLINK]: CONFIG_NETWORKS.lightlink.nid,
    [NETWORK.ETHEREUM]: CONFIG_NETWORKS.ethereum.nid,
    [NETWORK.REDBELLY]: CONFIG_NETWORKS.redbelly.nid,
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
    [CONFIG_NETWORKS.archway.nid]: [NETWORK.ARCHWAY],
    [CONFIG_NETWORKS.stacks.nid]: [NETWORK.STACKS],
    [CONFIG_NETWORKS.base.nid]: [NETWORK.BASE],
    [CONFIG_NETWORKS.optimism.nid]: [NETWORK.OPTIMISM],
    [CONFIG_NETWORKS.polygon.nid]: [NETWORK.POLYGON],
    [CONFIG_NETWORKS.arbitrum.nid]: [NETWORK.ARBITRUM],
    [CONFIG_NETWORKS.bsc.nid]: [NETWORK.BSC],
    [CONFIG_NETWORKS.nibiru.nid]: [NETWORK.NIBIRU],
    [CONFIG_NETWORKS.hyperliquid.nid]: [NETWORK.HYPERLIQUID],
    [CONFIG_NETWORKS.botanix.nid]: [NETWORK.BOTANIX],
    [CONFIG_NETWORKS.lightlink.nid]: [NETWORK.LIGHTLINK],
    [CONFIG_NETWORKS.ethereum.nid]: [NETWORK.ETHEREUM],
    [CONFIG_NETWORKS.redbelly.nid]: [NETWORK.REDBELLY],
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
    [NETWORK.ARCHWAY]: {
        id: NETWORK.ARCHWAY,
        name: 'archway',
        logo: `/images/network-archway.png`,
        nativeAsset: 'const',
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
    [NETWORK.BOTANIX]: {
        id: NETWORK.BOTANIX,
        name: 'botanix',
        logo: `/images/network-botanix.png`,
        nativeAsset: 'btc',
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
    Migration: 'Migration'
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
    NETWORK_MAPPINGS
}
