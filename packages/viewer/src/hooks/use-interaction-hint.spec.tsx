// @vitest-environment jsdom
/**
 * The first-time hint appears once the scene is ready, worded for the
 * visitor's input, and goes for good on their first move or after a while.
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { INTERACTION_HINT_MS, useInteractionHint } from './use-interaction-hint'

let container: HTMLDivElement
let coarse: boolean

beforeEach(() => {
	vi.useFakeTimers()
	coarse = false
	vi.stubGlobal('matchMedia', (query: string) => ({
		matches: coarse && query === '(pointer: coarse)'
	}))
	container = document.createElement('div')
	container.tabIndex = 0
	document.body.replaceChildren(container)
})

afterEach(() => {
	vi.useRealTimers()
	vi.unstubAllGlobals()
})

const mount = (props: { enabled?: boolean; ready?: boolean } = {}) =>
	renderHook(
		({ enabled, ready }) => useInteractionHint({ enabled, ready, container }),
		{ initialProps: { enabled: true, ready: true, ...props } }
	)

describe('useInteractionHint', () => {
	it('waits for the scene to be ready', () => {
		const { result, rerender } = mount({ ready: false })
		expect(result.current.visible).toBe(false)
		rerender({ enabled: true, ready: true })
		expect(result.current.visible).toBe(true)
	})

	it('words it for a mouse, or for touch on a coarse pointer', () => {
		expect(mount().result.current.input).toBe('mouse')
		coarse = true
		expect(mount().result.current.input).toBe('touch')
	})

	it('words it for keys once the viewer is reached from the keyboard', () => {
		const { result } = mount()
		vi.spyOn(container, 'matches').mockReturnValue(true)
		act(() => container.dispatchEvent(new FocusEvent('focus')))
		expect(result.current.input).toBe('keys')
	})

	it.each([
		['a press', () => new MouseEvent('pointerdown')],
		['a scroll', () => new WheelEvent('wheel')],
		['a key', () => new KeyboardEvent('keydown', { key: 'ArrowLeft' })]
	])('goes for good on %s', (_, event) => {
		const { result, rerender } = mount()
		act(() => container.dispatchEvent(event()))
		expect(result.current.visible).toBe(false)
		rerender({ enabled: true, ready: true })
		expect(result.current.visible).toBe(false)
	})

	it('goes by itself after a while', () => {
		const { result } = mount()
		act(() => vi.advanceTimersByTime(INTERACTION_HINT_MS - 1))
		expect(result.current.visible).toBe(true)
		act(() => vi.advanceTimersByTime(1))
		expect(result.current.visible).toBe(false)
	})

	it('shows once per page view, even when turned off and on again', () => {
		const { result, rerender } = mount()
		rerender({ enabled: false, ready: true })
		expect(result.current.visible).toBe(false)
		rerender({ enabled: true, ready: true })
		expect(result.current.visible).toBe(false)
	})

	it('never shows where it is off', () => {
		expect(mount({ enabled: false }).result.current.visible).toBe(false)
	})
})
