import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The server sink, exercised rather than inspected.
 *
 * This is the half that carries the load. `posthog-js` is initialised opted out
 * and stays that way until a visitor accepts analytics, so client-side
 * reporting covers only consenting sessions - while every loader, action and
 * resource route on the server reports unconditionally. If this path is broken
 * the product is back to console logs in Fly with no grouping or alerting,
 * which is the state this change exists to leave.
 */

const captureException = vi.fn()

vi.mock('../app/lib/posthog/posthog-client.server', () => ({
	getPosthogClient: () => ({ captureException }),
	distinctIdFromRequest: (request: Request) =>
		request.headers.get('X-POSTHOG-DISTINCT-ID') ?? undefined
}))

/*
  Static, not a top-level `await import`. `vi.mock` is hoisted above every
  import in the file, so the mock is already in place when this binding
  resolves - and the spec tsconfig does not allow top-level await.
*/
import { reportServerError } from '../app/lib/observability/report-server-error.server'

/** The context a call site inside a request handler passes. */
const serving = (url: string, init?: RequestInit) => ({
	request: new Request(url, init)
})

describe('reportServerError', () => {
	/*
	  Spied once and cleared per test, not re-spied per test: `vi.spyOn` on an
	  already-spied method hands back the same mock with its history intact, so
	  re-spying in `beforeEach` leaves earlier tests' calls in place and a
	  call-count assertion counts the whole file.
	*/
	const logged = vi.spyOn(console, 'error').mockImplementation(() => {})

	beforeEach(() => {
		captureException.mockClear()
		logged.mockClear()
	})

	it('captures an error thrown while serving a request', () => {
		reportServerError(
			new Error('the loader threw'),
			serving('https://vectreal.io/api/scenes/s1')
		)

		expect(captureException).toHaveBeenCalledTimes(1)
		expect(captureException.mock.calls[0][0]).toMatchObject({
			message: 'the loader threw'
		})
	})

	it('tags the request it happened on', () => {
		reportServerError(
			new Error('boom'),
			serving('https://vectreal.io/api/scenes/s1/assets/a1', { method: 'GET' })
		)

		expect(captureException.mock.calls[0][2]).toMatchObject({
			error_source: 'server',
			on_critical_path: true,
			critical_flows: ['publish-scene', 'authorize-embed'],
			pathname: '/api/scenes/s1/assets/a1',
			request_method: 'GET'
		})
	})

	/*
	  Ties the exception to the session that provoked it. `posthog-js` injects
	  this header on same-origin requests, and without it a server-side error is
	  an anonymous 500 with no way back to what the user was doing.
	*/
	it('attributes it to the reporting session', () => {
		reportServerError(
			new Error('boom'),
			serving('https://vectreal.io/pricing', {
				headers: { 'X-POSTHOG-DISTINCT-ID': 'visitor-9' }
			})
		)

		expect(captureException.mock.calls[0][1]).toBe('visitor-9')
	})

	/*
	  A client that navigated away mid-response is not a defect, and the abort
	  reaches this function as an error. React Router's own default handler skips
	  these for the same reason.
	*/
	it('ignores an aborted request', () => {
		const controller = new AbortController()
		controller.abort()

		reportServerError(
			new Error('aborted'),
			serving('https://vectreal.io/api/scenes/s1', {
				signal: controller.signal
			})
		)

		expect(captureException).not.toHaveBeenCalled()
	})

	/*
	  Exporting `handleError` replaces React Router's built-in handler, which
	  logged and did nothing else. Losing the log would be a regression on the
	  one signal the product already had.
	*/
	it('still logs, so Fly keeps what it always had', () => {
		reportServerError(new Error('boom'), serving('https://vectreal.io/pricing'))
		expect(logged).toHaveBeenCalledTimes(1)
	})

	/*
	  Much of the code that swallows a failure is a repository or a service with
	  no request in scope. An unattributed report is worth far more than none -
	  and this is the path `stripe-subscription-sync.server.ts` reports through,
	  where the alternative was a log asking an operator to reconcile a
	  subscription that was still billing a deleted account.
	*/
	it('reports without a request at all', () => {
		reportServerError(new Error('cancel failed'), {
			properties: { organizationId: 'org-1' }
		})

		expect(captureException).toHaveBeenCalledTimes(1)
		const [error, distinctId, properties] = captureException.mock.calls[0]
		expect(error).toMatchObject({ message: 'cancel failed' })
		expect(distinctId).toBeUndefined()
		expect(properties).toMatchObject({
			error_source: 'server',
			organizationId: 'org-1',
			on_critical_path: false
		})
		expect(properties).not.toHaveProperty('pathname')
	})

	/*
	  The call sites this replaced logged `{ sceneId, assetId, userId }` beside
	  the error, and that context is the difference between a stack and a lead.
	*/
	it("carries the call site's own context", () => {
		reportServerError(new Error('boom'), {
			...serving('https://vectreal.io/api/scenes/s1'),
			properties: { sceneId: 's1', assetId: 'a1' }
		})

		expect(captureException.mock.calls[0][2]).toMatchObject({
			sceneId: 's1',
			assetId: 'a1',
			pathname: '/api/scenes/s1'
		})
	})

	/*
	  A call site must not be able to shadow the keys alerts filter on, whether
	  by accident or by copying the wrong example.
	*/
	it('does not let a call site overwrite the reserved keys', () => {
		reportServerError(new Error('boom'), {
			...serving('https://vectreal.io/api/scenes/s1'),
			properties: { on_critical_path: false, error_source: 'client-boundary' }
		})

		expect(captureException.mock.calls[0][2]).toMatchObject({
			on_critical_path: true,
			error_source: 'server'
		})
	})

	/*
	  Adding `properties` added a second way for a live credential to leave, and
	  it is the way the old code habitually used - `console.error('failed', { url })`.
	*/
	it('redacts an embed token passed as call site context', () => {
		reportServerError(new Error('boom'), {
			properties: { sourceUrl: '/embed/p/s?token=vk_live_secret' }
		})

		expect(JSON.stringify(captureException.mock.calls[0][2])).not.toContain(
			'vk_live_secret'
		)
	})

	/*
	  A compile-time guarantee, asserted rather than assumed. `properties` takes
	  scalars because `redactEmbedTokenFromProperties` returns a class instance
	  untouched by design - so an `Error` smuggled in as a property would reach
	  PostHog with its message and stack unredacted. If this stops being a type
	  error, `tsconfig.spec.json` fails on the unused directive and says so.
	*/
	it('will not accept an error as a property', () => {
		reportServerError(new Error('boom'), {
			// @ts-expect-error properties are scalars; the error is the first argument
			properties: { cause: new Error('token=vk_live_secret') }
		})

		expect(captureException).toHaveBeenCalledTimes(1)
	})

	/*
	  An embed authenticates by a `token` query parameter, so a live API key is in
	  the URL of every embed request. `posthog-node` has no `before_send` hook and
	  serializes the message itself, so nothing but the redaction in
	  `buildErrorReport` stands between that key and a third party - and #750 had
	  to remove this exact leak from the client once already.
	*/
	it('never ships an embed token, to PostHog or to the log', () => {
		reportServerError(
			new Error('upstream failed for /embed/p/s?token=vk_live_secret'),
			serving('https://vectreal.io/embed/p/s?token=vk_live_secret')
		)

		const [error, , properties] = captureException.mock.calls[0]
		expect(
			JSON.stringify([error.message, error.stack, properties])
		).not.toContain('vk_live_secret')
		expect(JSON.stringify(logged.mock.calls)).not.toContain('vk_live_secret')
	})
})
