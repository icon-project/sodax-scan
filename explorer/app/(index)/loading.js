import { Hero, HeroOverlap } from '@/components/hero'
import SkeletonTable from '@/components/skeleton-table'
import { Headline } from '@/components/page-title'
import SearchBar from '@/components/searchbar'

export default function Loading() {
    return (
        <div>
            <Hero>
            <div className="py-10 flex items-end justify-between w-full">
                <div className="basis-8/12">
                    <Headline before="Explore" accent="all" after="messages" className="pb-2" />
                    <SearchBar showFull={true} />
                </div>
                <div className="basis-4/12 flex flex-row-reverse items-end ">
                    <div className="px-4 text-white rounded-md text-right  ">
                        <div className="text-xs uppercase tracking-wider">Total Messages</div>
                        <div className="text-3xl font-medium fade-in">0</div>
                    </div>
                </div>
            </div>
            </Hero>

            <HeroOverlap>
                <SkeletonTable />
            </HeroOverlap>
        </div>
    )
}
