import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

/**
 * The command center is never reachable anonymously. This only enforces
 * "signed in" - whether the identity is actually a founder is decided by
 * `requireAdmin` inside every /api/admin route, which is the real boundary.
 */
const isAdminRoute = createRouteMatcher(['/admin(.*)', '/api/admin(.*)'])

export default clerkMiddleware(async (auth, request) => {
    if (isAdminRoute(request)) await auth.protect()
})

export const config = {
    matcher: [
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        '/(api|trpc)(.*)',
        '/__clerk/:path*',
    ],
}
