import '../globals.css'
import { inter, inriaSerif, shrikhand } from '../fonts'
import Header from '@/components/header'
import Footer from '@/components/footer'
import { Hero, HeroOverlap } from '@/components/hero'
import PageTitle from '@/components/page-title'

export const metadata = {
    title: 'SODAX Scan',
    // Hidden ops tooling — keep it out of search indexes.
    robots: { index: false, follow: false }
}

export default function DebugLayout({ children }) {
    return (
        <html lang="en" className={`${inter.variable} ${inriaSerif.variable} ${shrikhand.variable}`}>
            <body className="font-sans text-espresso min-h-screen bg-vibrant-white">
                <Header showSearchBar={false} />
                <main className="px-4 mb-2 xl:px-24 xl:mb-12 2xl:px-48">
                    <div className="min-h-[34rem] 2xl:min-h-[46rem]">
                        <Hero>
                            <PageTitle before="Restricted" accent="area" />
                        </Hero>
                        <HeroOverlap>{children}</HeroOverlap>
                    </div>
                </main>
                <Footer />
            </body>
        </html>
    )
}
