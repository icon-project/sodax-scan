import '../globals.css'
import { inter, shrikhand } from '../fonts'
import Header from '@/components/header'
import Footer from '@/components/footer'

export const metadata = {
    title: 'SODAXScan',
    // Hidden ops tooling — keep it out of search indexes.
    robots: { index: false, follow: false }
}

export default function DebugLayout({ children }) {
    return (
        <html lang="en" className={`${inter.variable} ${shrikhand.variable}`}>
            <body className="font-sans text-espresso min-h-screen bg-almost-white">
                <Header showSearchBar={false} />
                <div className="-z-20 h-72 w-full absolute hero"></div>
                <main className="px-4 mb-2 xl:px-24 xl:mb-12 2xl:px-48">
                    <div className="min-h-[34rem] 2xl:min-h-[46rem]">{children}</div>
                </main>
                <Footer />
            </body>
        </html>
    )
}
