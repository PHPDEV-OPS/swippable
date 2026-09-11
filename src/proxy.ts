import { clerkMiddleware } from '@clerk/nextjs/server'

/**
 * Session handling only. Authorisation is resource-based, which is what Clerk
 * now recommends and what actually holds:
 *
 *   - every /api/admin route calls `requireAdmin`, which answers 404 for anyone
 *     who is not a founder
 *   - `/api/checkout` calls `requireUser` and will only charge the caller's own
 *     cards
 *   - `AdminShell` and `AuthGuard` send signed-out visitors to /sign-in
 *
 * Path matching in middleware can diverge from how Next.js actually routes a
 * request, so it is a poor place to put the boundary - and protecting pages
 * there returned a bare 404 to a signed-out visitor instead of the sign-in page.
 */
export default clerkMiddleware()

export const config = {
    matcher: [
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        '/(api|trpc)(.*)',
        '/__clerk/:path*',
    ],
}
