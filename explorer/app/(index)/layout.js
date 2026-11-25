import '../globals.css'
import { inter, inriaSerif, shrikhand } from '../fonts'
import Favicon from '../favicon.ico'
import ThemeHead from '@/components/theme-head'
import Header from '@/components/header'
import AdminBar from '@/components/admin-bar'
import Footer from '@/components/footer'
import ApiBanner from '@/components/api-banner'
import fetchData from '@/lib/fetch-data'

export const metadata = {
    title: `SODAX Scan · Fast and reliable message tracking`,
    description: `SODAX Scan tracks SODAX transactions across blockchain networks.`,
    icons: [{ rel: 'icon', url: Favicon.src }],
    openGraph: {
        title: "SODAX Scan · Fast and reliable message tracking",
        description: "SODAX Scan tracks SODAX transactions across blockchain networks.",
        url: "https://sodaxscan.com",
        siteName: "SODAX Scan",
        images: [
            {
                url: "https://sodaxscan.com/images/link-preview.png",
                width: 1200,
                height: 630,
                alt: "SODAX Scan Preview",
            },
        ],
        locale: "en_US",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "SODAX Scan",
        description: "SODAX Scan tracks SODAX transactions across blockchain networks.",
        images: ["https://sodaxscan.com/images/link-preview.png"],
    },
}

export default async function RootLayout({ children }) {
    let assets = [
        { name: 'BNB', symbol: 'BNB', image: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png', current_price: 0, price_change_percentage_24h: 0 }
    ]
    try {
        assets = await fetchData.getAssets()
        // // random assets
        // assets = assets.sort(() => Math.random() - Math.random()).slice(0, 8)
    } catch (error) {
        console.log('error', error)
    }

    return (
        <html lang="en" suppressHydrationWarning className={`${inter.variable} ${inriaSerif.variable} ${shrikhand.variable}`}>
            <head>
                <ThemeHead />
            </head>
            <body className="font-sans text-fg min-h-screen bg-surface">
                <Header showSearchBar={false} assets={assets} />
                <AdminBar />
                <main className="px-4 mb-2 xl:px-24 xl:mb-12 2xl:px-48">
                    <div className="min-h-[34rem] 2xl:min-h-[46rem]">{children}</div>
                </main>
                <ApiBanner />
                <Footer />
            </body>
        </html>
    )
}
