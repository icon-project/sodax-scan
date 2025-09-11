const dotenv = require('dotenv')
dotenv.config()

const TestnetDeployment = require('./configs/testnet_deployment.json')
const MainnetDeployment = require('./configs/mainnet_deployment.json')

const USE_MAINNET = process.env.USE_MAINNET == 'true'
const CONFIG_NETWORKS = USE_MAINNET ? MainnetDeployment.networks : TestnetDeployment.networks
const RATE_LIMIT = process.env.RATE_LIMIT ? process.env.RATE_LIMIT : 10

const WEB3_ALCHEMY_API_KEY = process.env.WEB3_ALCHEMY_API_KEY
const WEB3_BLAST_API_KEY = process.env.WEB3_BLAST_API_KEY
const WEB3_CHAINSTACK_API_KEY = process.env.WEB3_CHAINSTACK_API_KEY
const WEB3_BLOCKVISION_API_KEY = process.env.WEB3_BLOCKVISION_API_KEY
const WEB3_ANKR_API_KEY = process.env.WEB3_ANKR_API_KEY
const WEB3_INSTANTNODES_API_KEY = process.env.WEB3_INSTANTNODES_API_KEY
const WEB3_QUICKNODE_API_KEY = process.env.WEB3_QUICKNODE_API_KEY

const NETWORK = {

    AVAX: CONFIG_NETWORKS.avax.nid,
    SUI: CONFIG_NETWORKS.sui.nid,
    NEAR: CONFIG_NETWORKS.near.nid,
    SONIC: CONFIG_NETWORKS.sonic.nid,
    ICON: CONFIG_NETWORKS.icon.nid,
    INJECTIVE: CONFIG_NETWORKS.injective.nid,
    STELLAR: CONFIG_NETWORKS.stellar.nid,
    SOLANA: CONFIG_NETWORKS.solana.nid,
    ARCHWAY: CONFIG_NETWORKS.archway.nid,
    STACKS: CONFIG_NETWORKS.stacks.nid,
    BASE: CONFIG_NETWORKS.base.nid,
    ARBITRUM: CONFIG_NETWORKS.arbitrum.nid,
    OPTIMISM: CONFIG_NETWORKS.optimism.nid,
    POLYGON: CONFIG_NETWORKS.polygon.nid,
    BSC: CONFIG_NETWORKS.bsc.nid,
    NIBIRU: CONFIG_NETWORKS.nibiru.nid,
    HYPERLIQUID: CONFIG_NETWORKS.hyperliquid.nid,
    BOTANIX: CONFIG_NETWORKS.botanix.nid,
    LIGHTLINK: CONFIG_NETWORKS.lightlink.nid

}

const buildProviderUrls = (urls) => {
    const correctUrls = []
    urls.forEach((url) => {
        // trim /
        url = url.replace(/\/+$/, '')

        if (url.includes('blockvision')) correctUrls.push(`${url}/${WEB3_BLOCKVISION_API_KEY}`)
        else if (url.includes('alchemy')) correctUrls.push(`${url}/${WEB3_ALCHEMY_API_KEY}`)
        else if (url.includes('chainstack')) correctUrls.push(`${url}/${WEB3_CHAINSTACK_API_KEY}`)
        else if (url.includes('blastapi')) correctUrls.push(`${url}/${WEB3_BLAST_API_KEY}`)
        else if (url.includes('ankr')) correctUrls.push(`${url}/${WEB3_ANKR_API_KEY}`)
        else if (url.includes('instantnodes')) correctUrls.push(`${url}/token-${WEB3_INSTANTNODES_API_KEY}`)
        else if (url.includes('quiknode')) correctUrls.push(`${url}/${WEB3_QUICKNODE_API_KEY}`)
        else correctUrls.push(url)
    })

    return correctUrls
}

const RPC_URLS = {

}

const META_URLS = {
    tx: {
        [NETWORK.BSC]: USE_MAINNET ? 'https://bscscan.com/tx/' : 'https://testnet.bscscan.com/tx/',
        [NETWORK.ICON]: USE_MAINNET ? 'https://tracker.icon.community/transaction/' : 'https://tracker.lisbon.icon.community/transaction/',
        [NETWORK.ETH2]: USE_MAINNET ? 'https://etherscan.io/tx/' : 'https://sepolia.etherscan.io/tx/',
        [NETWORK.HAVAH]: USE_MAINNET ? 'https://scan.havah.io/txn/' : 'https://scan.vega.havah.io/txn/',
        [NETWORK.IBC_ARCHWAY]: USE_MAINNET ? 'https://mintscan.io/archway/txs/' : 'https://testnet.mintscan.io/archway-testnet/txs/',
        [NETWORK.IBC_NEUTRON]: USE_MAINNET ? 'https://neutron.celat.one/neutron-1/txs/' : 'https://neutron.celat.one/pion-1/txs/',
        [NETWORK.IBC_INJECTIVE]: USE_MAINNET
            ? 'https://explorer.injective.network/transaction/'
            : 'https://testnet.explorer.injective.network/transaction/',
        [NETWORK.AVAX]: USE_MAINNET ? 'https://snowtrace.io/tx/' : 'https://testnet.snowtrace.io/tx/',
        [NETWORK.BASE]: USE_MAINNET ? 'https://basescan.org/tx/' : 'https://sepolia.basescan.org/tx/',
        [NETWORK.ARBITRUM]: USE_MAINNET ? 'https://arbiscan.io/tx/' : 'https://sepolia.arbiscan.io/tx/',
        [NETWORK.OPTIMISM]: USE_MAINNET ? 'https://optimistic.etherscan.io/tx/' : 'https://sepolia-optimism.etherscan.io/tx/',
        [NETWORK.SUI]: USE_MAINNET ? 'https://suivision.xyz/txblock/' : 'https://testnet.suivision.xyz/txblock/',
        [NETWORK.POLYGON]: USE_MAINNET ? 'https://polygonscan.com/tx/' : 'https://amoy.polygonscan.com/tx/',
        [NETWORK.STELLAR]: USE_MAINNET ? 'https://stellar.expert/explorer/public/tx/' : 'https://stellar.expert/explorer/testnet/tx/',
        [NETWORK.SOLANA]: USE_MAINNET ? 'https://solscan.io/tx/{txHash}' : 'https://solscan.io/tx/{txHash}?cluster=devnet',
        [NETWORK.NEAR]: USE_MAINNET ? 'https://nearblocks.io/txns/' : 'https://testnet.nearblocks.io/txns/',
        [NETWORK.SONIC]: USE_MAINNET ? 'https://sonicscan.org/tx/' : 'https://testnet.sonicscan.org/tx/',
        [NETWORK.INJECTIVE]: USE_MAINNET
            ? 'https://explorer.injective.network/transaction/'
            : 'https://testnet.explorer.injective.network/transaction/',
        [NETWORK.ARCHWAY]: USE_MAINNET ? 'https://mintscan.io/archway/txs/' : 'https://www.mintscan.io/archway-testnet/tx/',
        [NETWORK.STACKS]: USE_MAINNET ? 'https://explorer.hiro.so/txid/{txHash}?chain=mainnet' : 'https://explorer.hiro.so/txid/{txHash}?chain=testnet',
        [NETWORK.NIBIRU]: USE_MAINNET ? 'https://nibiscan.io/tx/' : 'https://testnet.nibiscan.io/tx/',
        [NETWORK.HYPERLIQUID]: USE_MAINNET ? 'https://liquidscan.io/tx/' : 'https://liquidscan.io/tx/',
        [NETWORK.BOTANIX]: USE_MAINNET ? 'https://botanixscan.io/tx/' : 'https://botanixscan.io/tx/',
        [NETWORK.LIGHTLINK]: USE_MAINNET ? 'https://phoenix.lightlink.io/tx/' : 'https://phoenix.lightlink.io/tx/',
    }
}

module.exports = {
    USE_MAINNET,
    NETWORK,
    RATE_LIMIT,
    RPC_URLS,
    META_URLS
}
