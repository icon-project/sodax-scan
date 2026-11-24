import PageTitle from '@/components/page-title'
import { Hero, HeroOverlap } from '@/components/hero'
import Spinner from '@/components/spinner'

export default function Loading() {
    return (
        <div>
            <Hero>
                <PageTitle before="Message" accent="info" />
            </Hero>
            <HeroOverlap>
                <div className="bg-white rounded-regular shadow-card">
                    <Spinner />
                </div>
            </HeroOverlap>
        </div>
    )
}
