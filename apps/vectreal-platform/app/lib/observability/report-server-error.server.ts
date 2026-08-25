import { buildErrorReport } from './error-report'
import {
	distinctIdFromRequest,
	getPosthogClient
} from '../posthog/posthog-client.server'

import type { ErrorProperties } from './error-report'

/**
 * The one path by which a server-side error leaves the process.
 *
 * Called from `entry.server.tsx` and nowhere else, through the two hooks that
 * between them see every unhandled error the server produces:
 *
 *   - `handleError`, which React Router calls for every loader, action,
 *     resource-route and document-render failure. Exporting it *replaces* the
 *     framework's own handler, which is why this function logs as well as
 *     reports - dropping the log would be a regression on the one signal the
 *     product already had.
 *   - `onError` inside `renderToPipeableStream`, for errors thrown after the
 *     shell has flushed. Those never reject the render promise, so
 *     `handleError` never sees them and this is their only route out.
 *
 * PostHog was chosen over a dedicated vendor because it is already a
 * dependency, already has a client and a shutdown hook in this process, already
 * carries the session id the browser is reporting under, and needs no new data
 * processing agreement. See the PR for the full argument.
 *
 * It is also called directly, from anywhere a failure is caught and turned into
 * a response or a degraded result instead of being allowed to escape. Those
 * never reach `handleError` - the framework only sees what is thrown past it -
 * so before this they were visible only as a `console.error` chosen per call
 * site. `stripe-subscription-sync.server.ts` asked an operator to reconcile a
 * subscription by hand through one of those, into a log with no alerting on it.
 *
 * Sending is fire-and-forget on purpose. `captureException` queues onto the
 * shared client's batch; nothing about serving this request waits on PostHog,
 * and PostHog being down must not turn a 500 into a hang.
 */
export type ServerErrorContext = {
	/**
	 * The request being served, when the failure happened inside one.
	 *
	 * Optional because much of the code that swallows a failure is a repository
	 * or a service with no request in scope, and an unattributed report is worth
	 * far more than none. What is lost without it is the pathname, the method,
	 * the reporting session and therefore the critical-flow tag - so pass it
	 * wherever it is in scope.
	 */
	request?: Request
	/** What the call site knows and the request does not. Scalars only. */
	properties?: ErrorProperties
}

export function reportServerError(
	error: unknown,
	{ request, properties }: ServerErrorContext = {}
): void {
	/*
	  A client that navigated away mid-response is not a defect, and its abort
	  surfaces here as an error. React Router's own default handler skips these
	  for the same reason; reporting them would fill the feed with the browser
	  behaving normally.
	*/
	if (request?.signal.aborted) return

	const report = buildErrorReport(error, {
		source: 'server',
		pathname: request ? new URL(request.url).pathname : undefined,
		method: request?.method,
		properties
	})
	if (!report) return

	/*
	  The one console.error the house rule allows, and the reason it can be
	  banned everywhere else: every caller's structured context is logged here
	  instead, so the sweep that replaced those calls did not cost Fly anything.

	  Redacted rather than raw - an embed token in a stack frame is a live
	  credential wherever it lands, and log retention is not a secret store.
	*/
	// eslint-disable-next-line no-console -- the single reporting sink
	console.error(report.error, report.properties)

	getPosthogClient()?.captureException(
		report.error,
		request ? distinctIdFromRequest(request) : undefined,
		report.properties
	)
}
