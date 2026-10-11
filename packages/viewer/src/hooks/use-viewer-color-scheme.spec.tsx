// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
	resolveViewerColorScheme,
	useViewerColorScheme
} from './use-viewer-color-scheme'

/** A `prefers-color-scheme: dark` query the test can flip. */
const stubDarkPreference = (initial: boolean) => {
	let matches = initial
	const listeners = new Set<() => void>()
	vi.stubGlobal(
		'matchMedia',
		vi.fn(() => ({
			get matches() {
				return matches
			},
			addEventListener: (_: string, listener: () => void) =>
				listeners.add(listener),
			removeEventListener: (_: string, listener: () => void) =>
				listeners.delete(listener)
		}))
	)
	return (next: boolean) => {
		matches = next
		listeners.forEach((listener) => listener())
	}
}

afterEach(() => {
	vi.unstubAllGlobals()
})

describe('resolveViewerColorScheme', () => {
	it('keeps an explicit theme whatever the visitor prefers', () => {
		expect(resolveViewerColorScheme('light', true)).toBe('light')
		expect(resolveViewerColorScheme('dark', false)).toBe('dark')
	})

	it("follows the visitor's preference under system", () => {
		expect(resolveViewerColorScheme('system', true)).toBe('dark')
		expect(resolveViewerColorScheme('system', false)).toBe('light')
	})
})

describe('useViewerColorScheme', () => {
	it('follows a preference that changes while the viewer is open', () => {
		const setDark = stubDarkPreference(false)
		const { result } = renderHook(() => useViewerColorScheme('system'))
		expect(result.current).toBe('light')

		act(() => setDark(true))
		expect(result.current).toBe('dark')
	})

	it('ignores the preference for an explicit theme', () => {
		stubDarkPreference(true)
		const { result } = renderHook(() => useViewerColorScheme('light'))
		expect(result.current).toBe('light')
	})
})

/*
  The canvas cannot mount under jsdom, so the wiring is read from source, as
  the viewer's other wiring specs do.
*/
describe("the viewer root's scheme class", () => {
	const wrapper = readFileSync(
		join(import.meta.dirname, '..', 'components', 'canvas-wrapper.tsx'),
		'utf8'
	)

	it('is resolved from the theme prop and set on the container', () => {
		expect(wrapper).toContain('const colorScheme = useViewerColorScheme(theme)')
		expect(wrapper).toMatch(
			/className=\{cn\('outline-none', colorScheme, containerClassName\)\}/
		)
	})
})
