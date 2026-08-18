import { describe, expect, it } from 'vitest'

import { resolvePublisherSurface } from './publisher-surface'

describe('resolvePublisherSurface', () => {
	it('asks for a file only on the base route', () => {
		expect(
			resolvePublisherSurface({ status: 'empty', hasSceneId: false })
		).toBe('drop-zone')
	})

	it('never shows the drop zone on a scene route', () => {
		for (const status of ['empty', 'loading', 'ready', 'error'] as const) {
			expect(
				resolvePublisherSurface({ status, hasSceneId: true })
			).not.toBe('drop-zone')
		}
	})

	it('waits rather than accusing when a scene route has not started loading', () => {
		expect(resolvePublisherSurface({ status: 'empty', hasSceneId: true })).toBe(
			'loading'
		)
	})

	it('keeps a rejected upload on the drop zone, where the next attempt happens', () => {
		expect(
			resolvePublisherSurface({ status: 'error', hasSceneId: false })
		).toBe('drop-zone')
	})

	it('reports a scene that failed to load as an error', () => {
		expect(resolvePublisherSurface({ status: 'error', hasSceneId: true })).toBe(
			'error'
		)
	})

	it('shows the model as soon as the loader has one', () => {
		expect(
			resolvePublisherSurface({ status: 'ready', hasSceneId: false })
		).toBe('viewer')
		expect(resolvePublisherSurface({ status: 'ready', hasSceneId: true })).toBe(
			'viewer'
		)
	})

	it('covers a publisher navigation with the loading surface', () => {
		expect(
			resolvePublisherSurface({
				status: 'empty',
				hasSceneId: false,
				isNavigating: true
			})
		).toBe('loading')
	})

	it('keeps the model on screen while navigating between scenes', () => {
		expect(
			resolvePublisherSurface({
				status: 'ready',
				hasSceneId: true,
				isNavigating: true
			})
		).toBe('viewer')
	})
})
