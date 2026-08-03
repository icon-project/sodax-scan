'use client'
import { useRouter } from 'next/navigation'

export default function DebugLogout() {
    const router = useRouter()
    async function logout() {
        await fetch('/admin-api/logout', { method: 'POST' })
        router.refresh()
    }
    return (
        <button onClick={logout} className="underline underline-offset-2 hover:text-white/80">
            Exit debug mode
        </button>
    )
}
