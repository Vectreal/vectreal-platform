// @vitest-environment jsdom
/**
 * The cleanup group switches each cheap, non-destructive step, mesh merging
 * among them, straight into the planned settings.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { describe, expect, it } from 'vitest'

import { CleanupFields } from './cleanup-fields'
import { balancedPreset } from '../../../../../constants/optimizations'
import { optimizationAtom } from '../../../../../lib/stores/scene-optimization-store'

describe('CleanupFields', () => {
	it('switches mesh merging in the planned settings', () => {
		const store = createStore()
		store.set(optimizationAtom, (prev) => ({
			...prev,
			optimizations: balancedPreset
		}))
		render(
			<Provider store={store}>
				<CleanupFields />
			</Provider>
		)

		const merge = screen.getByRole('switch', { name: /Merge meshes/ })
		expect(merge).toHaveAttribute('aria-checked', 'true')

		fireEvent.click(merge)

		expect(store.get(optimizationAtom).optimizations.merge).toEqual({
			enabled: false
		})
		expect(store.get(optimizationAtom).optimizationPreset).toBe('custom')
	})
})
