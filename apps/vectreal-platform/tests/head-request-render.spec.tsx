import { Suspense, use } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A HEAD request must not leave a render running that nobody will read.
 *
 * React Router answers HEAD with `new Response(null, ...)` and drops the body
 * `handleRequest` returned without cancelling it (`requestHandler` in
 * react-router's `server-runtime/server.js`). The adapter then finishes the
 * response, so `request.signal` never aborts either. Nothing stopped the
 * render, so under a burst of `HEAD /` probes every render still unfinished
 * at the stream timeout was aborted, and each pending boundary reached the
 * error sink: 127 false server errors from one burst.
 *
 * A boundary that never resolves stands in for a render the timeout catches.
 * Only the timer is faked: React schedules its own work with `setImmediate`.
 */

const { reportServerError } = vi.hoisted(() => ({
	reportServerError: vi.fn()
}))

vi.mock('../app/lib/observability/report-server-error.server', () => ({
	reportServerError
}))

const never = new Promise<never>(() => {})

function Pending(): null {
	return use(never)
}

/** What the page suspends on, per case. */
const page = { Suspended: Pending as () => null }

vi.mock('react-router', async (importOriginal) => ({
	...(await importOriginal<typeof import('react-router')>()),
	ServerRouter: () => (
		<html lang="en">
			<body>
				<p>shell</p>
				<Suspense fallback={<p>loading</p>}>
					<page.Suspended />
				</Suspense>
			</body>
		</html>
	)
}))

import handleRequest, { streamTimeout } from '../app/entry.server'

import type { EntryContext, RouterContextProvider } from 'react-router'

function render(method: string): Promise<Response> {
	return handleRequest(
		new Request('https://vectreal.com/', { method }),
		200,
		new Headers(),
		{ isSpaMode: false } as EntryContext,
		{} as RouterContextProvider
	) as Promise<Response>
}

/** Lets React's `setImmediate` work and any stream callbacks run. */
const settle = () => new Promise((resolve) => setImmediate(resolve))

describe('a HEAD request', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
		reportServerError.mockClear()
		page.Suspended = Pending
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('reports nothing when the stream timeout passes', async () => {
		// Like React Router: the body is never read.
		const response = await render('HEAD')
		expect(response.status).toBe(200)

		await vi.advanceTimersByTimeAsync(streamTimeout + 1_000)
		await settle()

		expect(reportServerError).not.toHaveBeenCalled()
	})

	/*
	  The work itself stops, not only its reports: a probe burst is many full
	  renders at once, which is what pushed them past the timeout.
	*/
	it('renders nothing past the shell', async () => {
		let rendered = false
		const soon = new Promise<void>((resolve) => setTimeout(resolve, 100))
		page.Suspended = function Soon() {
			use(soon)
			rendered = true
			return null
		}

		await render('HEAD')
		await vi.advanceTimersByTimeAsync(100)
		await settle()

		expect(rendered).toBe(false)
	})

	it('keeps the status and headers it answered with before', async () => {
		const response = await render('HEAD')

		expect(response.status).toBe(200)
		expect(response.body).toBeNull()
		expect(response.headers.get('Content-Type')).toBe('text/html')
		expect(response.headers.get('Cache-Control')).toBe('no-store')
	})

	/*
	  The guard is the method, not the timeout: a GET page still streaming
	  when the timeout fires is a render that did not finish for a visitor
	  who was waiting for it, and stays reported.
	*/
	it('leaves a GET render that times out reported', async () => {
		const response = await render('GET')
		const reading = response.text()

		await vi.advanceTimersByTimeAsync(streamTimeout + 1_000)
		await reading

		expect(reportServerError).toHaveBeenCalledTimes(1)
	})
})
