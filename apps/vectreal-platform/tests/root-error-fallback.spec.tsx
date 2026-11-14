// @vitest-environment jsdom
/**
 * What root's `Layout` shows when an error reaches it, rendered through the
 * real router.
 *
 * A 404 thrown by a route with no nearer boundary lands here: the publisher
 * layout, the legal short links, two dashboard pages. The branch used to run
 * `JSON.stringify` on the error, so visitors read the router's error response
 * as raw JSON, and its meta was the home page's, canonical and `index` included.
 */
import { format } from 'node:util'

import { render, screen } from '@testing-library/react'
import {
	createRoutesStub,
	data,
	UNSAFE_ErrorResponseImpl as ErrorResponseImpl
} from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Layout, meta } from '../app/root'

import type { MetaArgs } from 'react-router'
import type { MockInstance } from 'vitest'

function renderRootError(thrown: unknown) {
	const Stub = createRoutesStub([
		{
			path: '/x',
			HydrateFallback: () => null,
			loader: () => {
				throw thrown
			},
			Component: () => null,
			ErrorBoundary: () => <Layout>{null}</Layout>
		}
	])
	render(<Stub initialEntries={['/x']} />)
}

describe('root Layout, when an error reaches it', () => {
	/*
	  Rendering a whole document into a test container warns, and so does a
	  routes stub with no build manifest, whose <Links> and <Scripts> carry an
	  empty href. Those two, and nothing else.
	*/
	let consoleError: MockInstance<typeof console.error>
	beforeEach(() => {
		consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
	})
	afterEach(() => {
		for (const args of consoleError.mock.calls) {
			expect(format(...args)).toMatch(
				/cannot be a child of|An empty string \(""\) was passed to the href attribute/
			)
		}
	})

	it('shows the not-found page for a 404', async () => {
		renderRootError(data(null, { status: 404 }))
		expect(await screen.findByText('This page does not exist')).toBeTruthy()
	})

	it('says access is refused for a 403, never its JSON', async () => {
		renderRootError(data({ secret: 'payload' }, { status: 403 }))
		expect(
			await screen.findByText('You do not have access to this page')
		).toBeTruthy()
		expect(document.body.textContent).not.toContain('payload')
		expect(document.body.textContent).not.toContain('"status"')
	})

	it('never shows an exception message', async () => {
		renderRootError(new Error('at db/client.ts:12 token=abc'))
		expect(
			await screen.findByText('Something went wrong on our side')
		).toBeTruthy()
		expect(document.body.textContent).not.toContain('db/client.ts')
	})
})

describe('root meta', () => {
	function robotsAndCanonical(error: unknown) {
		const tags = meta({ error } as MetaArgs) as Record<string, unknown>[]
		return {
			robots: tags.find((tag) => tag.name === 'robots')?.content,
			canonical: tags.some((tag) => tag.rel === 'canonical')
		}
	}

	it.each([
		new ErrorResponseImpl(404, 'Not Found', null),
		new ErrorResponseImpl(403, 'Forbidden', null),
		new Error('boom')
	])('keeps %o out of the index and points it nowhere', (error) => {
		expect(robotsAndCanonical(error)).toEqual({
			robots: 'noindex, nofollow',
			canonical: false
		})
	})

	it('still marks a normal page canonical to home', () => {
		expect(robotsAndCanonical(undefined).canonical).toBe(true)
	})
})
