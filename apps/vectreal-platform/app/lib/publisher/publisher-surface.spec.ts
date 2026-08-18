import { describe, expect, it } from 'vitest'

import { resolvePublisherSurface } from './publisher-surface'

describe('resolvePublisherSurface', () => {
	it('asks for a file only when there is no scene to show', () => {
		expect(resolvePublisherSurface({ status: 'empty', hasScene: false })).toBe(
			'drop-zone'
		)
	})

	it('never shows the drop zone once a scene is being shown', () => {
		for (const status of ['empty', 'loading', 'ready', 'error'] as const) {
			expect(resolvePublisherSurface({ status, hasScene: true })).not.toBe(
				'drop-zone'
			)
		}
	})

	it('waits rather than accusing when a scene has not started loading', () => {
		expect(resolvePublisherSurface({ status: 'empty', hasScene: true })).toBe(
			'loading'
		)
	})

	it('keeps a rejected upload on the drop zone, where the next attempt happens', () => {
		expect(resolvePublisherSurface({ status: 'error', hasScene: false })).toBe(
			'drop-zone'
		)
	})

	it('reports a scene that failed to load as an error', () => {
		expect(resolvePublisherSurface({ status: 'error', hasScene: true })).toBe(
			'error'
		)
	})

	it('shows the model as soon as the loader has one', () => {
		expect(resolvePublisherSurface({ status: 'ready', hasScene: false })).toBe(
			'viewer'
		)
		expect(resolvePublisherSurface({ status: 'ready', hasScene: true })).toBe(
			'viewer'
		)
	})

	it('covers a publisher navigation with the loading surface', () => {
		expect(
			resolvePublisherSurface({
				status: 'empty',
				hasScene: false,
				isNavigating: true
			})
		).toBe('loading')
	})

	it('keeps the model on screen while navigating between scenes', () => {
		expect(
			resolvePublisherSurface({
				status: 'ready',
				hasScene: true,
				isNavigating: true
			})
		).toBe('viewer')
	})
})
