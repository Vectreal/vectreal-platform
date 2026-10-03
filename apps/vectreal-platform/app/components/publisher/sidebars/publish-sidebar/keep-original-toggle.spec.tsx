// @vitest-environment jsdom
/**
 * The author's choice to keep the original. It must only appear while there
 * is an original worth keeping, and say what keeping it costs.
 */
import { formatFileSize } from '@shared/utils'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { describe, expect, it, vi } from 'vitest'

import { KeepOriginalToggle } from './keep-original-toggle'
import {
	originalPreset,
	smallestPreset
} from '../../../../constants/optimizations'
import { MAX_STORED_FILE_BYTES } from '../../../../constants/utility-constants'
import {
	keptOriginalAtom,
	optimizationAtom
} from '../../../../lib/stores/scene-optimization-store'

const SOURCE = new Uint8Array(2_000_000)
const optimizerSource = vi.hoisted(() => ({
	current: null as { byteLength: number } | null
}))

vi.mock('@vctrl/hooks/use-load-model', () => ({
	useModelContext: () => ({
		optimizer: { getSource: () => optimizerSource.current ?? SOURCE }
	})
}))

const renderToggle = (
	sourceSettings = originalPreset,
	derivedFrom = smallestPreset
) => {
	const store = createStore()
	store.set(optimizationAtom, (prev) => ({
		...prev,
		sourceSettings,
		derivedFrom
	}))
	render(
		<Provider store={store}>
			<KeepOriginalToggle />
		</Provider>
	)
	return store
}

describe('KeepOriginalToggle', () => {
	it('offers keeping the original of an optimized upload, with its cost', () => {
		renderToggle()

		expect(
			screen.getByRole('switch', { name: 'Keep the original' })
		).toBeTruthy()
		expect(
			screen.getByText(new RegExp(formatFileSize(SOURCE.byteLength)))
		).toBeTruthy()
	})

	// Once the drawer has loaded it, the original is no longer pending a
	// download, but the server still keeps it, and turning it off removes it.
	it('never counts an original the scene already keeps as new storage', () => {
		const store = renderToggle()
		act(() =>
			store.set(keptOriginalAtom, {
				keep: true,
				stored: null,
				saved: true,
				unreadable: false
			})
		)

		expect(screen.getByText(/Already counted in your storage/)).toBeTruthy()
		expect(screen.queryByText(/Adds about/)).toBeNull()
	})

	it('warns that saving removes an original the scene keeps', () => {
		const store = renderToggle()
		act(() =>
			store.set(keptOriginalAtom, {
				keep: false,
				stored: null,
				saved: true,
				unreadable: false
			})
		)

		expect(screen.getByText(/Saving removes the original/)).toBeTruthy()
	})

	it('says why an original too large for storage is not kept', () => {
		optimizerSource.current = { byteLength: MAX_STORED_FILE_BYTES + 1 }
		try {
			renderToggle()

			const toggle = screen.getByRole('switch', { name: 'Keep the original' })
			expect(toggle.hasAttribute('disabled')).toBe(true)
			expect(toggle.getAttribute('aria-checked')).toBe('false')
			expect(screen.getByText(/so it is not kept/)).toBeTruthy()
		} finally {
			optimizerSource.current = null
		}
	})

	it('stays out of the way while the model is the original', () => {
		renderToggle(originalPreset, originalPreset)

		expect(screen.queryByRole('switch')).toBeNull()
	})

	it('stays out of the way when there is no original, only a saved version', () => {
		renderToggle(smallestPreset, smallestPreset)

		expect(screen.queryByRole('switch')).toBeNull()
	})

	it('records the author turning it off', () => {
		const store = renderToggle()

		fireEvent.click(screen.getByRole('switch', { name: 'Keep the original' }))

		expect(store.get(keptOriginalAtom).keep).toBe(false)
	})
})
