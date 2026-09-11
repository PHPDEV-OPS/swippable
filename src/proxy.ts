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
 * Path matching here can diverge from how Next.js actually routes a request, so
 * it is a poor place to put the boundary - and protecting pages here returned a
 * bare 404 to a signed-out visitor instead of the sign-in page.
 *
 * This lives in `proxy.ts` rather than `middleware.ts`: Next 16 deprecated the
 * middleware file convention, and Clerk reads either. Without it `auth()`
 * throws "Clerk can't detect usage of clerkMiddleware()" and every server
 * component that checks the session 500s.
 */
export default clerkMiddleware()

export const config = {
    matcher: [
        '/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        '/(api|trpc)(.*)',
        '/__clerk/:path*',
    ],
}
