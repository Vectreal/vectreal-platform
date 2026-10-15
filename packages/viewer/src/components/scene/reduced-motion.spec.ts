// @vitest-environment jsdom
/**
 * Every camera switch (a marker click, `activate_camera`, the way back from a
 * hotspot) goes through `startTransition`, so the visitor's motion preference
 * is read there, once, rather than at each caller.
 *
 * The wiring half is a source guard: `SceneCamera` needs a WebGL context this
 * package's runner does not have.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { prefersReducedMotion } from './reduced-motion'

const stubPreference = (reduce: boolean) =>
	vi.stubGlobal(
		'matchMedia',
		vi.fn((query: string) => ({
			matches: reduce && query === '(prefers-reduced-motion: reduce)'
		}))
	)

afterEach(() => {
	vi.unstubAllGlobals()
})

describe('prefersReducedMotion', () => {
	it('is true when the visitor asked for reduced motion', () => {
		stubPreference(true)
		expect(prefersReducedMotion()).toBe(true)
	})

	it('is false otherwise', () => {
		stubPreference(false)
		expect(prefersReducedMotion()).toBe(false)
	})
})

describe('camera switches under reduced motion', () => {
	const camera = readFileSync(
		join(import.meta.dirname, 'scene-camera.tsx'),
		'utf8'
	)
	const startTransition = camera.slice(
		camera.indexOf('const startTransition = useCallback('),
		camera.indexOf('applyCameraInstantly(selection)')
	)

	it('take the instant branch', () => {
		expect(startTransition).toContain('prefersReducedMotion()')
	})
})
