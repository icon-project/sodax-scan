import { Hero, HeroOverlap } from '@/components/hero'
import SkeletonTable from '@/components/skeleton-table'
import { Headline } from '@/components/page-title'
import SearchBar from '@/components/searchbar'
import TotalCounter from '@/components/total-counter'

// Mirrors the hero in page.tsx (same wrappers, spacing and total) so nothing jumps
// when the page takes over. Filter chips are static placeholders here: they become
// interactive once the page has loaded.
const CHIP = 'inline-flex items-center gap-1 rounded-full border border-cherry-bright/60 dark:border-cherry-brighter/80 px-3 text-sm text-white'
const FILTERS = ['Route', 'Status', 'Source', 'Destination', 'Action']

function Chevron() {
    return (
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
    )
}

export default function Loading() {
    return (
        <div>
            <Hero tightMobile>
            <div className="py-2 xl:py-6 xl:flex xl:items-end xl:justify-between w-full">
                <div className="xl:basis-8/12">
                    <Headline before="Explore" accent="all" after="messages" className="pb-3" />
                    <SearchBar showFull={true} />
                </div>
                <div className="mt-4 xl:mt-0 xl:basis-4/12 hidden md:flex flex-row-reverse items-end">
                    <div className="px-4 text-right hidden md:block">
                        <div className="text-xs uppercase tracking-wider text-cherry-brighter mb-1">Total Messages</div>
                        <div className="text-5xl xl:text-6xl font-normal text-soda-bright leading-none tabular-nums"><TotalCounter /></div>
                    </div>
                </div>
            </div>

            {/* Mobile (< md): Filters chip + total on one row, as on the page */}
            <div className="md:hidden flex items-center justify-between gap-3 pt-2 text-white" aria-hidden="true">
                <span className={`${CHIP} h-9 gap-1.5 px-3.5`}>
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="w-4 h-4 shrink-0">
                        <path d="M3 5.5h8M15 5.5h2M3 14.5h2M9 14.5h8" />
                        <circle cx="13" cy="5.5" r="1.8" />
                        <circle cx="7" cy="14.5" r="1.8" />
                    </svg>
                    Filters
                </span>
                <div className="flex items-baseline gap-1.5">
                    <span className="text-xl text-soda-bright leading-none tabular-nums"><TotalCounter /></span>
                    <span className="text-xs uppercase tracking-wider text-cherry-brighter">messages</span>
                </div>
            </div>

            {/* md+: filter chips in the same row and size as MessageFilter */}
            <div className="hidden md:flex flex-wrap items-center md:flex-nowrap md:justify-end p-1 gap-2 text-white rounded-md" aria-hidden="true">
                {FILTERS.map((label) => (
                    <span key={label} className={`${CHIP} py-1.5`}>
                        {label}
                        <Chevron />
                    </span>
                ))}
                <span className="rounded-full px-3 py-1.5 text-sm text-white">Reset</span>
            </div>
            </Hero>

            <HeroOverlap>
                <SkeletonTable />
            </HeroOverlap>
        </div>
    )
}
