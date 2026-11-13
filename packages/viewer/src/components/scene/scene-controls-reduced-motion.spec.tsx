// @vitest-environment jsdom
/**
 * A visitor who asked for reduced motion gets a still model: auto-rotate stays
 * off whatever the scene or a host asked for.
 */
import { render } from '@testing-library/react'
import { forwardRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import SceneControls from './scene-controls'

const received = vi.hoisted(() => ({
	autoRotate: undefined as unknown,
	props: {} as Record<string, unknown>
}))

vi.mock('@react-three/drei', () => ({
	OrbitControls: forwardRef(function OrbitControls(props: {
		autoRotate?: boolean
	}) {
		received.autoRotate = props.autoRotate
		received.props = props
		return null
	})
}))

vi.mock('@react-three/fiber', () => ({
	useFrame: () => undefined,
	useThree: (select: (state: unknown) => unknown) =>
		select({ events: { connected: null } })
}))

const prefersReducedMotion = (reduce: boolean) =>
	vi.stubGlobal(
		'matchMedia',
		(query: string) =>
			({
				matches: reduce && query === '(prefers-reduced-motion: reduce)'
			}) as MediaQueryList
	)

afterEach(() => vi.unstubAllGlobals())

describe('SceneControls under reduced motion', () => {
	it('turns the model when the visitor has not asked for less motion', () => {
		prefersReducedMotion(false)
		render(<SceneControls autoRotate />)
		expect(received.autoRotate).toBe(true)
	})

	it('holds it still when they have', () => {
		prefersReducedMotion(true)
		render(<SceneControls autoRotate />)
		expect(received.autoRotate).toBe(false)
	})
})

describe('SceneControls and the settings the viewer owns', () => {
	it('keeps double-click to focus off OrbitControls', () => {
		prefersReducedMotion(false)
		render(<SceneControls focusOnDoubleClick />)
		expect(received.props).not.toHaveProperty('focusOnDoubleClick')
	})
})
