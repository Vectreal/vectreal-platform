import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
	CRITICAL_FLOWS,
	criticalFlowsForPathname
} from '../app/lib/observability/critical-flows'
import { buildErrorReport } from '../app/lib/observability/error-report'

/**
 * What the reporting rules actually do, tested without a PostHog client.
 *
 * Note what this file does *not* contain: any of the module paths in
 * `CRITICAL_FLOWS`. `critical-path.spec.ts` decides whether a funnel module is
 * covered by searching every spec's source text for an import of it, so writing
 * one of those paths here as a string would report that module as guarded by
 * this file. Flows are referred to by id below for that reason.
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

describe('critical flow attribution', () => {
	it('has a unique id per step', () => {
		const ids = CRITICAL_FLOWS.map((flow) => flow.id)
		expect(new Set(ids).size).toBe(ids.length)
	})

	/*
	  Every pattern is checked against the route table rather than against a
	  reviewer's memory of it. A pattern for a route that has moved matches
	  nothing and tags nothing, silently and forever, which is the failure mode
	  worth a test: it looks exactly like "no errors on the critical path".
	*/
	it('names only routes that are still registered', () => {
		const routeConfig = readFileSync(
			join(REPO_ROOT, 'apps/vectreal-platform/app/routes.tsx'),
			'utf8'
		)
		const missing = CRITICAL_FLOWS.flatMap((flow) =>
			flow.routes
				.filter((route) => !routeConfig.includes(`'${route.file}'`))
				.map((route) => `${flow.id} -> ${route.file}`)
		)
		expect(missing).toEqual([])
	})

	it.each([
		[
			'/api/scenes/abc',
			['save-scene', 'publish-scene', 'authorize-embed', 'serve-manifest']
		],
		['/api/scenes/abc/assets/xyz', ['publish-scene', 'authorize-embed']],
		['/api/scenes/abc/thumbnail/xyz', ['publish-scene']],
		['/api/projects/p1/api-keys', ['mint-api-key', 'allow-domain']],
		['/dashboard/api-keys/new', ['mint-api-key']],
		['/dashboard/projects/edit/p1', ['allow-domain']],
		['/dashboard/projects/p1/edit', ['allow-domain']],
		['/embed/p1/s1', ['authorize-embed', 'render-embed-scene']],
		['/preview/p1/s1', ['copy-snippet', 'render-embed-scene']],
		['/publisher/s1', ['serve-manifest']],
		// Off the funnel entirely. Reported, but not as a critical-path failure.
		['/pricing', []],
		['/dashboard/billing', []],
		['/news-room/some-article', []]
	])('%s belongs to %j', (pathname, expected) => {
		expect(criticalFlowsForPathname(pathname)).toEqual(expected)
	})

	/*
	  The scene page and the edit drawer are the same URL shape, and the drawer's
	  route sorts first. Without the lookaheads in the scene pattern, an error in
	  "allow the storefront domain" would be filed under "copy a snippet" - a
	  wrong attribution, which is worse than none because it is believed.
	*/
	it('does not confuse the scene page with the edit drawer', () => {
		// The scene detail panel both offers the snippet and draws the scene, so
		// an error there is attributable to either step.
		expect(criticalFlowsForPathname('/dashboard/projects/p1/s1')).toEqual([
			'copy-snippet',
			'render-embed-scene'
		])
		expect(
			criticalFlowsForPathname('/dashboard/projects/edit/p1')
		).not.toContain('copy-snippet')
		expect(
			criticalFlowsForPathname('/dashboard/projects/p1/edit')
		).not.toContain('copy-snippet')
	})
})

describe('buildErrorReport', () => {
	const server = { source: 'server' } as const

	it('reports a thrown Error, tagged with its source', () => {
		const report = buildErrorReport(new Error('boom'), server)
		expect(report?.error.message).toBe('boom')
		expect(report?.properties.error_source).toBe('server')
	})

	it('reports a thrown string', () => {
		expect(buildErrorReport('boom', server)?.error.message).toBe('boom')
	})

	/*
	  Thrown objects are circular all the time - a DOM event, a Node error
	  holding its socket, a component's props - and `JSON.stringify` throws on
	  one. A reporter that throws while describing an exception takes out the
	  request it was reporting on, which is a worse outage than the error it was
	  called for.
	*/
	it('survives a thrown value it cannot serialize', () => {
		const circular: Record<string, unknown> = { kind: 'weird' }
		circular.self = circular

		expect(() => buildErrorReport(circular, server)).not.toThrow()
		expect(buildErrorReport(circular, server)).not.toBeNull()
	})

	/*
	  A 404 for a scene that does not exist, or a 403 for a member who may not
	  delete, is the product working. Reporting those buries the real failures
	  under routine traffic, which is how teams end up not reading the feed.
	*/
	it.each([404, 403, 429, 499])('drops a deliberate %i', (status) => {
		expect(
			buildErrorReport(
				{ status, statusText: 'No', data: null, internal: false },
				server
			)
		).toBeNull()
	})

	it('reports a 500 response, with its status', () => {
		const report = buildErrorReport(
			{ status: 500, statusText: 'Boom', data: null, internal: false },
			server
		)
		expect(report?.properties.route_status).toBe(500)
		expect(report?.error.message).toBe('500 Boom')
	})

	it('unwraps the real error a route response is carrying', () => {
		const report = buildErrorReport(
			{
				status: 404,
				statusText: 'Not Found',
				data: null,
				internal: false,
				error: new Error('the loader actually threw')
			},
			server
		)
		expect(report?.error.message).toBe('the loader actually threw')
		expect(report?.properties.route_status).toBe(404)
	})

	it('marks a funnel path as on the critical path', () => {
		const report = buildErrorReport(new Error('boom'), {
			source: 'server',
			pathname: '/api/scenes/abc/assets/xyz',
			method: 'GET'
		})
		expect(report?.properties.on_critical_path).toBe(true)
		expect(report?.properties.critical_flows).toContain('authorize-embed')
		expect(report?.properties.request_method).toBe('GET')
	})

	it('leaves a path off the funnel unmarked', () => {
		const report = buildErrorReport(new Error('boom'), {
			source: 'client-boundary',
			pathname: '/pricing'
		})
		expect(report?.properties.on_critical_path).toBe(false)
		expect(report?.properties.critical_flows).toEqual([])
	})

	/*
	  An embed authenticates by a `token` query parameter, so a live API key is in
	  the URL of every embed request - and therefore in the message of anything
	  that formats that URL into a failure, and in any stack frame naming it.
	  `posthog-js` strips those through `before_send`; `posthog-node` has no such
	  hook and serializes `message` and `stack` itself, so the only place to
	  intervene is the error handed to it. #750 already had to stop the client
	  leaking this key. An exception reporter is not allowed to put it back.
	*/
	describe('embed token redaction', () => {
		it('strips the token from the message', () => {
			const report = buildErrorReport(
				new Error('fetch failed: /embed/p/s?token=vk_live_secret&x=1'),
				server
			)
			expect(report?.error.message).not.toContain('vk_live_secret')
			expect(report?.error.message).toContain('token=redacted')
			// The rest of the URL survives, or the report is useless.
			expect(report?.error.message).toContain('/embed/p/s')
			expect(report?.error.message).toContain('x=1')
		})

		it('strips the token from the stack', () => {
			const error = new Error('boom')
			error.stack = 'Error: boom\n    at /embed/p/s?token=vk_live_secret:1:1'
			expect(buildErrorReport(error, server)?.error.stack).not.toContain(
				'vk_live_secret'
			)
		})

		it('strips the token from the reported pathname', () => {
			const report = buildErrorReport(new Error('boom'), {
				source: 'server',
				pathname: '/embed/p/s?token=vk_live_secret'
			})
			expect(String(report?.properties.pathname)).not.toContain(
				'vk_live_secret'
			)
		})

		it('does not rewrite the caller’s error in place', () => {
			const original = new Error('token=vk_live_secret')
			buildErrorReport(original, server)
			expect(original.message).toBe('token=vk_live_secret')
		})

		it('keeps name and stack, which is what PostHog groups on', () => {
			const original = new TypeError('boom')
			const report = buildErrorReport(original, server)
			expect(report?.error.name).toBe('TypeError')
			expect(report?.error.stack).toBe(original.stack)
		})
	})
})
