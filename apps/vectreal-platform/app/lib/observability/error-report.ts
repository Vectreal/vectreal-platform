import { isRouteErrorResponse } from 'react-router'

import { criticalFlowsForPathname } from './critical-flows'
import {
	redactEmbedToken,
	redactEmbedTokenFromProperties
} from '../posthog/redact-embed-token'

/**
 * Everything both reporting sinks agree on, with no PostHog import on either
 * side.
 *
 * There are two sinks because there have to be - the browser reports through
 * `posthog-js` and the server through `posthog-node` - but there is only one
 * set of rules about what counts as reportable, what an error is called, and
 * what travels with it. Those rules live here, pure, so they are testable
 * without a PostHog client and cannot drift apart between the two sides.
 *
 * @see use-error-report.ts - the client sink, called by every error boundary
 * @see report-server-error.server.ts - the server sink, called by entry.server
 */

export type ErrorSource = 'client-boundary' | 'server'

export type ErrorReport = {
	/**
	 * The error to hand to `captureException`, already stripped of embed tokens.
	 * Never the caller's object: see `redactError`.
	 */
	error: Error
	/** Properties to send alongside it. */
	properties: Record<string, unknown>
}

/**
 * What a call site may attach, beyond what the error and request already say.
 *
 * Scalars only, and that is a guarantee rather than a style preference.
 * `redactEmbedTokenFromProperties` walks strings, arrays and plain objects; a
 * class instance is returned untouched, by design, so that redacting cannot
 * silently rebuild somebody's `Date` as a bare object. An `Error` passed as a
 * property would therefore travel to PostHog with its message and stack
 * unredacted - and the habit this replaces was logging `{ sceneId, error }`.
 * The type makes that a compile error instead of a leak. The error itself is
 * the first argument.
 */
export type ErrorProperties = Record<
	string,
	string | number | boolean | null | undefined
>

export type ErrorReportContext = {
	source: ErrorSource
	/** Used for critical-flow attribution. Undefined where it is not knowable. */
	pathname?: string
	/** HTTP method, server side only. */
	method?: string
	/** What the call site knows and the request does not. */
	properties?: ErrorProperties
}

/**
 * The same error with any embed API key removed from its message and stack.
 *
 * An embed authenticates by a `token` query parameter, so a live credential
 * turns up in the URL of every `/embed` request - and therefore in the message
 * of anything that formats that URL into a failure, and in any stack frame that
 * names it. `#750` already had to stop the client sending that key to PostHog
 * through `$current_url`; an exception reporter that ships it in the message
 * instead would put it straight back.
 *
 * `posthog-js` covers its own side through the `before_send` hook installed in
 * `entry.client.tsx`, which walks every property of every event. `posthog-node`
 * has no equivalent, and `captureException` serializes `message` and `stack`
 * itself rather than reading our property bag, so the only place to intervene
 * is the error object handed to it. Doing it here rather than in the server
 * sink keeps both sides on one rule.
 *
 * A copy rather than a mutation: the caller's error is also on its way to the
 * application's own logs and to whatever else holds a reference to it, and
 * rewriting somebody else's exception in place is not this module's business.
 * `name`, `message` and `stack` are what PostHog groups on, so all three are
 * carried across - and nothing else is. Dropping `cause` and any custom fields
 * is the point rather than an oversight: they are exactly where an unreviewed
 * value would ride out, and the redaction rule has to be "these three, checked"
 * rather than "everything, hopefully".
 */
function redactError(error: Error): Error {
	const redacted = new Error(redactEmbedToken(error.message))
	redacted.name = error.name
	redacted.stack = error.stack ? redactEmbedToken(error.stack) : undefined
	return redacted
}

/**
 * The same value as an `Error`, whatever it started as.
 *
 * A thrown string, a thrown object and a rejected non-Error all reach a
 * boundary, and `captureException` needs a name and a message to group on.
 *
 * `JSON.stringify` throws on a circular structure, and thrown objects are
 * circular all the time - a DOM event, a Node error holding its socket, a
 * component's props. An exception reporter that throws while describing an
 * exception takes out the request it was reporting on, so the failure is
 * absorbed rather than allowed to escape.
 */
function toError(value: unknown): Error {
	if (value instanceof Error) return redactError(value)
	if (typeof value === 'string') return new Error(redactEmbedToken(value))

	let described: string
	try {
		described = JSON.stringify(value) ?? String(value)
	} catch {
		described = String(value)
	}

	return new Error(redactEmbedToken(described))
}

/**
 * What to report for an error, or `null` if it is not a defect.
 *
 * The one judgement call here is the status floor. A thrown `Response` is the
 * product working: a 404 for a scene that does not exist, a 403 for a member
 * who may not delete, a 429 for someone hammering sign-in. Reporting those
 * would bury the real failures under routine traffic, which is the failure mode
 * that makes teams stop reading their exception feed. Anything at 500 or above
 * is reported, because a deliberate 500 is still something being wrong.
 *
 * A route error response that wraps a real error (`error.error`, which React
 * Router sets when a loader threw rather than returned) is reported as that
 * inner error, so the stack survives.
 */
export function buildErrorReport(
	error: unknown,
	{ source, pathname, method, properties }: ErrorReportContext
): ErrorReport | null {
	let reportable: unknown = error
	let routeStatus: number | undefined

	if (isRouteErrorResponse(error)) {
		routeStatus = error.status
		/*
		  Read off the shape rather than the type. React Router's
		  `ErrorResponseImpl` carries the original error here when a loader threw
		  rather than returned, but the exported `ErrorResponse` type does not
		  declare the field - so this is a narrowing of what is actually there,
		  not a cast that claims something stronger.
		*/
		const thrown = (error as { error?: unknown }).error
		if (thrown instanceof Error) {
			reportable = thrown
		} else {
			if (error.status < 500) return null
			reportable = new Error(
				`${error.status} ${error.statusText || 'Error'}`.trim()
			)
		}
	}

	const criticalFlows =
		pathname === undefined ? [] : criticalFlowsForPathname(pathname)

	return {
		error: toError(reportable),
		/*
		  Redacted as one bag, through the same function `entry.client.tsx` hands
		  to `before_send`, so caller properties are covered by the rule that
		  covers everything else rather than by whatever each call site
		  remembered.
		*/
		properties: redactEmbedTokenFromProperties({
			/*
			  Caller properties first. The computed keys below are the contract
			  alerts filter on, so a call site must not be able to shadow one by
			  passing `on_critical_path` of its own.
			*/
			...properties,
			error_source: source,
			/*
			  The boolean is what an alert filters on; the ids are for narrowing
			  once it has fired. A list property is awkward to threshold against,
			  and "is anything on the funnel broken" is the question worth paging
			  someone about.
			*/
			on_critical_path: criticalFlows.length > 0,
			critical_flows: criticalFlows,
			...(pathname === undefined ? {} : { pathname }),
			...(method === undefined ? {} : { request_method: method }),
			...(routeStatus === undefined ? {} : { route_status: routeStatus })
		})
	}
}
