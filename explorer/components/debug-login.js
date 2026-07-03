'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DebugLogin() {
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    async function onSubmit(e) {
        e.preventDefault()
        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            })
            if (res.ok) {
                // Cookie is set httpOnly by the server. Go to the explorer —
                // debug mode is now active globally (admin bar + re-submit
                // controls appear on the normal pages). refresh() re-runs the
                // server components so the admin bar shows immediately.
                router.push('/')
                router.refresh()
                return
            }
            setError(res.status === 429 ? 'Too many attempts — wait a minute.' : 'Incorrect password.')
        } catch {
            setError('Something went wrong. Try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="pt-16 flex justify-center">
            <form onSubmit={onSubmit} className="w-full max-w-sm bg-white rounded-xl shadow-md p-8">
                <h1 className="text-2xl text-espresso tracking-tight pb-1">
                    <span className="font-display italic text-cherry">Restricted</span> area
                </h1>
                <p className="text-sm text-clay-dark mb-6">Enter the admin password to continue.</p>
                <input
                    type="password"
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="block w-full p-3 text-sm border border-clay-light rounded-lg focus:outline-none focus:border-cherry focus:ring-1 focus:ring-cherry"
                />
                {error ? <div className="text-sm text-cherry mt-3">{error}</div> : null}
                <button
                    type="submit"
                    disabled={loading}
                    className="mt-6 w-full rounded-full bg-cherry hover:bg-cherry-hover disabled:bg-cherry-disabled text-white font-medium py-3 transition-colors"
                >
                    {loading ? 'Checking…' : 'Enter'}
                </button>
            </form>
        </div>
    )
}
