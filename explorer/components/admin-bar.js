import { isAdmin } from '@/lib/admin-server'
import DebugLogout from './debug-logout'

// Server component: renders a persistent bar under the nav ONLY for an
// authenticated admin session. Returns nothing for normal visitors, so the
// bar (and the fact that debug mode exists) never reaches their markup.
export default function AdminBar() {
    if (!isAdmin()) return null
    return (
        <div className="w-full bg-espresso text-cream-white text-sm">
            <div className="px-4 py-2 xl:px-24 2xl:px-48 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-soda-bright animate-pulse" />
                    <span className="uppercase tracking-wide text-xs">Debug mode active</span>
                    <span className="hidden md:inline text-cherry-brighter">— open a pending message to re-submit it to the relay.</span>
                </div>
                <DebugLogout />
            </div>
        </div>
    )
}
