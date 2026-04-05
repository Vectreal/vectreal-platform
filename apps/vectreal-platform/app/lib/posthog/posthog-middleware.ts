import { PostHog } from 'posthog-node'

import type { Route } from '../../+types/root'
import type { RouterContextProvider } from 'react-router'

export interface PostHogContext extends RouterContextProvider {
	posthog?: PostHog
}

/**
 * Server-side PostHog middleware for React Router v7 framework mode.
 *
 * Per request this middleware:
 * 1. Creates a PostHog Node client with flush-on-each-request settings
 * 2. Reads X-POSTHOG-SESSION-ID / X-POSTHOG-DISTINCT-ID tracing headers
 *    injected by the posthog-js client, and passes them as context so that
 *    server-side events are automatically tied to the correct user session
 * 3. Calls shutdown() after next() to flush all queued events before the
 *    response is returned
 */
export const posthogMiddleware: Route.MiddlewareFunction = async (
	{ request, context },
	next
) => {
	const token = process.env.VITE_PUBLIC_POSTHOG_TOKEN
	const host = process.env.VITE_PUBLIC_POSTHOG_HOST

	// Skip if not configured (e.g. local dev without env vars)
	if (!token || !host) {
		return next()
	}

	const posthog = new PostHog(token, {
		host,
		flushAt: 1,
		flushInterval: 0
	})

	const sessionId = request.headers.get('X-POSTHOG-SESSION-ID') ?? undefined
	const distinctId = request.headers.get('X-POSTHOG-DISTINCT-ID') ?? undefined

	;(context as PostHogContext).posthog = posthog

	const response = await posthog.withContext({ sessionId, distinctId }, next)

	await posthog.shutdown().catch(() => {})

	return response
}
