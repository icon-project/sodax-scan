import PageTitle from '@/components/page-title'
import { Hero, HeroOverlap } from '@/components/hero'
import SkeletonTable from '@/components/skeleton-table'

export default function Loading() {
    return (
        <div>
            <Hero>
                <PageTitle before="Message" accent="feed" />
            </Hero>
            <HeroOverlap>
                <SkeletonTable />
            </HeroOverlap>
        </div>
    )
}
