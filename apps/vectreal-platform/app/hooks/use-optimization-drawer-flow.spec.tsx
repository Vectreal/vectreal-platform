// @vitest-environment jsdom
/**
 * The optimizer opens once when the scene shown is over the plan's max scene
 * size, which publishing enforces. Saving is never refused for size, so this
 * is the only nudge before a publish would be.
 */
import { act, renderHook } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { createElement, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

import { useOptimizationDrawerFlow } from './use-optimization-drawer-flow'
import { optimizationModalAtom } from '../lib/stores/scene-optimization-store'

const saveAvailability = { canSave: true, reason: 'ready' } as const

function renderFlow(isOverSizeLimit: boolean) {
	const store = createStore()
	const wrapper = ({ children }: { children: ReactNode }) =>
		createElement(Provider, { store }, children)
	const view = renderHook(
		(props: { isOverSizeLimit: boolean }) =>
			useOptimizationDrawerFlow({
				saveAvailability,
				hasUnsavedLocationChange: false,
				...props
			}),
		{ wrapper, initialProps: { isOverSizeLimit } }
	)
	return { ...view, store }
}

describe('useOptimizationDrawerFlow', () => {
	it('leaves the optimizer closed while the scene fits', () => {
		const { store } = renderFlow(false)

		expect(store.get(optimizationModalAtom).isOpen).toBe(false)
	})

	it('opens the optimizer when the scene is over the limit', () => {
		const { store } = renderFlow(true)

		expect(store.get(optimizationModalAtom).isOpen).toBe(true)
	})

	it('does not force it open again once closed while still over', () => {
		const { result, rerender, store } = renderFlow(true)

		act(() => result.current.handleOptimizationDrawerChange(false))
		rerender({ isOverSizeLimit: true })

		expect(store.get(optimizationModalAtom).isOpen).toBe(false)
	})
})
