import { PostHog } from 'posthog-node'

import type { Route } from '../../+types/root'
import type { RouterContextProvider } from 'react-router'

export interface PostHogContext extends RouterContextProvider {
	posthog?: PostHog
}

let sharedPosthogClient: null | PostHog = null
let shutdownHookRegistered = false

function getPosthogClient(): null | PostHog {
	const token = process.env.VITE_PUBLIC_POSTHOG_TOKEN
	const host = process.env.VITE_PUBLIC_POSTHOG_HOST

	if (!token || !host) {
		return null
	}

	if (!sharedPosthogClient) {
		sharedPosthogClient = new PostHog(token, {
			host,
			// Batch events and flush on interval to keep requests non-blocking.
			flushAt: 20,
			flushInterval: 10_000
		})
	}

	if (!shutdownHookRegistered) {
		shutdownHookRegistered = true
		process.once('beforeExit', () => {
			sharedPosthogClient?.shutdown().catch(() => {})
		})
	}

	return sharedPosthogClient
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
	const posthog = getPosthogClient()

	// Skip if not configured (for example local dev without env vars)
	if (!posthog) {
		return next()
	}

	const sessionId = request.headers.get('X-POSTHOG-SESSION-ID') ?? undefined
	const distinctId = request.headers.get('X-POSTHOG-DISTINCT-ID') ?? undefined

	;(context as PostHogContext).posthog = posthog

	return posthog.withContext({ sessionId, distinctId }, next)
}
