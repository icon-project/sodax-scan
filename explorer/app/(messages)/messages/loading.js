import PageTitle from '@/components/page-title'
import SkeletonTable from '@/components/skeleton-table'

export default function Loading() {
    return (
        <div>
             <PageTitle before="Message" accent="feed" />
             <SkeletonTable />
        </div>
    )
}
