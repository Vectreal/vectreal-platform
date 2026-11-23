/**
 * Only a found scene may be kept by the browser: a miss also stands for a
 * lookup that failed for a moment, and keeping it would hide the tour for
 * minutes after the failure passed.
 */
import { describe, expect, it, vi } from 'vitest'

import { loader } from './home-tour'
import { resolveHomeTour } from '../../lib/samples/home-tour-scene.server'

vi.mock('../../lib/samples/home-tour-scene.server', () => ({
	resolveHomeTour: vi.fn()
}))

const call = () =>
	loader({
		request: new Request('https://vectreal.com/api/home-tour')
	} as Parameters<typeof loader>[0])

describe('GET /api/home-tour', () => {
	it('lets the browser keep a found scene for a few minutes', async () => {
		vi.mocked(resolveHomeTour).mockResolvedValueOnce({
			embedPath: '/embed/p/s?token=t',
			posterUrl: null,
			title: null
		})
		const response = await call()
		expect(response.status).toBe(200)
		expect(response.headers.get('Cache-Control')).toBe('public, max-age=300')
	})

	it('never lets a miss be kept', async () => {
		vi.mocked(resolveHomeTour).mockResolvedValueOnce(null)
		const response = await call()
		expect(response.status).toBe(404)
		expect(response.headers.get('Cache-Control')).toBe('no-store')
	})
})
