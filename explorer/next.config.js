/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        appDir: true
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**.coinmarketcap.com'
            },
            {
                protocol: 'https',
                hostname: '**.coingecko.com'
            }
        ],
        domains: ['sodaxscan.com', 'testnet.sodaxscan.com'],
        minimumCacheTTL: 60 * 60 * 24 * 7,
    },
    eslint: {
        // Warning: This allows production builds to successfully complete even if
        // your project has ESLint errors.
        ignoreDuringBuilds: true
    },
    env: {}
}

module.exports = nextConfig
