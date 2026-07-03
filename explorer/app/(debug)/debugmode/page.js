import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin-server'
import DebugLogin from '@/components/debug-login'

// Login gate only. Once authenticated, debug mode is a global state (the admin
// bar + per-message re-submit controls appear on the normal explorer pages),
// so there's nothing to show here — send the user back to the explorer.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default function DebugPage() {
    if (isAdmin()) {
        redirect('/')
    }
    return <DebugLogin />
}
