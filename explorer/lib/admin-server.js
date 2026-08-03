import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from './admin'

// Server-only: is the current request an authenticated admin session?
// Call from Server Components / route handlers only (reads request cookies).
export function isAdmin() {
    try {
        return verifyToken(cookies().get(COOKIE_NAME)?.value)
    } catch {
        return false
    }
}
