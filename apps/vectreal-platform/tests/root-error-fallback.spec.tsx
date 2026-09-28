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
import { render, screen } from '@testing-library/react'
import {
	createRoutesStub,
	data,
	UNSAFE_ErrorResponseImpl as ErrorResponseImpl
} from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { Layout, meta } from '../app/root'

import type { MetaArgs } from 'react-router'

function renderRootError(thrown: unknown) {
	const Stub = createRoutesStub([
		{
			path: '/x',
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
	// Rendering <html> into a test container is expected to warn.
	vi.spyOn(console, 'error').mockImplementation(() => {})

	it('shows the not-found page for a 404', async () => {
		renderRootError(data(null, { status: 404 }))
		expect(await screen.findByText('This page does not exist')).toBeTruthy()
	})

	it('names the status of any other response, never its JSON', async () => {
		renderRootError(data({ secret: 'payload' }, { status: 403 }))
		expect(await screen.findByText('Something went wrong')).toBeTruthy()
		expect(document.body.textContent).toContain('403')
		expect(document.body.textContent).not.toContain('payload')
		expect(document.body.textContent).not.toContain('"status"')
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

	it('keeps a 404 out of the index and points it nowhere', () => {
		expect(
			robotsAndCanonical(new ErrorResponseImpl(404, 'Not Found', null))
		).toEqual({ robots: 'noindex, nofollow', canonical: false })
	})

	it('still marks a normal page canonical to home', () => {
		expect(robotsAndCanonical(undefined).canonical).toBe(true)
	})
})
