import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { UnauthorizedError } from '@/lib/auth'

/**
 * Wraps a route handler so internal failures are reported to Sentry and logged
 * server-side, while the client only ever sees a generic message - no stack
 * traces, SQL, or provider payloads leak out of the API surface.
 */
export function withRouteErrors<Args extends unknown[]>(
    name: string,
    handler: (...args: Args) => Promise<Response>
) {
    return async (...args: Args): Promise<Response> => {
        try {
            return await handler(...args)
        } catch (error) {
            if (error instanceof UnauthorizedError) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            }
            if (error instanceof HttpError) {
                return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
            }

            console.error(`[api:${name}]`, error)
            Sentry.captureException(error, { tags: { route: name } })
            return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
        }
    }
}

/** A failure that is safe to surface verbatim to the client. */
export class HttpError extends Error {
    status: number
    code?: string

    constructor(status: number, message: string, code?: string) {
        super(message)
        this.name = 'HttpError'
        this.status = status
        this.code = code
    }
}

export function badRequest(message: string, code?: string): never {
    throw new HttpError(400, message, code)
}

export function notFound(message = 'Not found'): never {
    throw new HttpError(404, message)
}

export function conflict(message: string, code?: string): never {
    throw new HttpError(409, message, code)
}

/** Reads and JSON-parses a request body, tolerating an empty one. */
export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
    try {
        const text = await request.text()
        return text ? (JSON.parse(text) as T) : ({} as T)
    } catch {
        return badRequest('Request body must be valid JSON')
    }
}
