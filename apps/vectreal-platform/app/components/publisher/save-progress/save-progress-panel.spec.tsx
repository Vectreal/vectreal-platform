// @vitest-environment jsdom
import { formatFileSize } from '@shared/utils'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SaveProgressPanel } from './save-progress-panel'
import { enterPreviewModeAtom } from '../../../lib/stores/publisher-config-store'
import { savePanelAtom } from '../../../lib/stores/save-progress-store'

import type { SavePanelState } from '../../../lib/domain/scene/client/scene-save-progress'

const uploading: SavePanelState = {
	status: 'uploading',
	message: null,
	files: [
		{
			key: 'body/diffuse.png',
			group: 'model',
			name: 'body/diffuse.png',
			bytes: 2_000_000,
			sent: 1_000_000,
			previewUrl: 'blob:diffuse',
			state: 'uploading'
		},
		{
			key: 'scene.gltf',
			group: 'model',
			name: 'scene.gltf',
			bytes: 1_000_000,
			sent: 0,
			previewUrl: null,
			state: 'waiting'
		}
	]
}

const renderPanel = (state: SavePanelState | null, onRetry = vi.fn()) => {
	const store = createStore()
	store.set(savePanelAtom, state)
	const view = render(
		<Provider store={store}>
			<SaveProgressPanel onRetry={onRetry} />
		</Provider>
	)
	return { store, onRetry, view }
}

/**
 * Answers `:focus-visible` as a browser would after a click (false) or a Tab
 * (true). jsdom's own answer depends on the events earlier tests fired.
 */
const answerFocusVisible = (isVisible: boolean) => {
	const matches = Element.prototype.matches
	vi.spyOn(Element.prototype, 'matches').mockImplementation(function (
		this: Element,
		selector: string
	) {
		return selector === ':focus-visible'
			? isVisible
			: matches.call(this, selector)
	})
}

beforeEach(() => {
	vi.useFakeTimers()
})

afterEach(() => {
	vi.useRealTimers()
	vi.restoreAllMocks()
})

describe('SaveProgressPanel', () => {
	it('shows nothing while there is no save', () => {
		renderPanel(null)

		expect(screen.queryByRole('region', { name: 'Save progress' })).toBeNull()
	})

	it('says how much of the save has gone up, by bytes', () => {
		renderPanel(uploading)

		expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
			'33'
		)
		expect(
			screen.getByText(
				`${formatFileSize(1_000_000)} of ${formatFileSize(3_000_000)}`
			)
		).toBeTruthy()
	})

	it('opens to its groups, and a group to its files with their thumbnails', () => {
		renderPanel(uploading)

		fireEvent.click(screen.getByRole('button', { name: 'Show save details' }))
		expect(screen.getByText('Scene settings')).toBeTruthy()

		fireEvent.click(screen.getByRole('button', { name: /Model/ }))
		expect(screen.getByText('body/diffuse.png')).toBeTruthy()
		expect(document.querySelector('img[src="blob:diffuse"]')).not.toBeNull()
	})

	it('leaves on its own once saved, while collapsed', () => {
		const { store } = renderPanel({ ...uploading, status: 'saved' })

		act(() => vi.advanceTimersByTime(4000))

		expect(store.get(savePanelAtom)).toBeNull()
	})

	it('stays once saved while the reader has it open', () => {
		const { store } = renderPanel({ ...uploading, status: 'saved' })
		fireEvent.click(screen.getByRole('button', { name: 'Show save details' }))

		act(() => vi.advanceTimersByTime(10_000))

		expect(store.get(savePanelAtom)).not.toBeNull()
	})

	it('stays once saved while the pointer is over it', () => {
		const { store } = renderPanel({ ...uploading, status: 'saved' })
		fireEvent.pointerEnter(
			screen.getByRole('region', { name: 'Save progress' })
		)

		act(() => vi.advanceTimersByTime(10_000))

		expect(store.get(savePanelAtom)).not.toBeNull()
	})

	it('leaves once saved when focus inside came from a click', () => {
		const { store } = renderPanel({ ...uploading, status: 'saved' })
		answerFocusVisible(false)
		act(() => screen.getByRole('button', { name: 'Show save details' }).focus())

		act(() => vi.advanceTimersByTime(4000))

		expect(store.get(savePanelAtom)).toBeNull()
	})

	it('stays once saved while keyboard focus is inside it', () => {
		answerFocusVisible(true)
		const { store } = renderPanel({ ...uploading, status: 'saved' })
		act(() => screen.getByRole('button', { name: 'Close' }).focus())

		act(() => vi.advanceTimersByTime(10_000))

		expect(store.get(savePanelAtom)).not.toBeNull()
	})

	it('hands focus back to where it came from when closed', () => {
		const outside = document.createElement('button')
		document.body.append(outside)
		const { store } = renderPanel({ ...uploading, status: 'saved' })
		act(() => outside.focus())
		act(() => screen.getByRole('button', { name: 'Close' }).focus())

		fireEvent.click(screen.getByRole('button', { name: 'Close' }))

		expect(store.get(savePanelAtom)).toBeNull()
		expect(document.activeElement).toBe(outside)
		outside.remove()
	})

	it('stays out of preview mode', () => {
		const store = createStore()
		store.set(savePanelAtom, uploading)
		store.set(enterPreviewModeAtom)

		render(
			<Provider store={store}>
				<SaveProgressPanel onRetry={vi.fn()} />
			</Provider>
		)

		expect(screen.queryByRole('region', { name: 'Save progress' })).toBeNull()
	})

	it('frees its previews when the publisher goes away', () => {
		const { store, view } = renderPanel(uploading)

		view.unmount()

		expect(store.get(savePanelAtom)).toBeNull()
	})

	it('announces the headline, not every byte, from the first one', () => {
		const { store } = renderPanel(null)
		// A live region announces changes, not what it mounts with, so it is
		// already there before the save starts.
		const live = document.querySelectorAll('[aria-live]')
		expect(live).toHaveLength(1)
		expect(live[0].textContent).toBe('')

		act(() => store.set(savePanelAtom, uploading))

		expect(document.querySelectorAll('[aria-live]')).toHaveLength(1)
		expect(live[0].textContent).toBe('Saving scene')
	})

	it('says the settings were not saved when the save failed', () => {
		renderPanel({ ...uploading, status: 'failed', message: 'disk full' })

		fireEvent.click(screen.getByRole('button', { name: 'Show save details' }))

		expect(screen.getByText('Not saved')).toBeTruthy()
	})

	it('keeps a failure on screen and offers to retry it', () => {
		const { store, onRetry } = renderPanel({
			...uploading,
			status: 'failed',
			message: 'disk full'
		})

		act(() => vi.advanceTimersByTime(10_000))
		expect(store.get(savePanelAtom)).not.toBeNull()
		expect(screen.getByText('disk full')).toBeTruthy()

		fireEvent.click(screen.getByRole('button', { name: /Retry/ }))
		expect(onRetry).toHaveBeenCalledOnce()
	})
	describe('while publishing', () => {
		const uploadingGlb: SavePanelState = {
			status: 'publishing',
			message: null,
			files: [],
			publish: {
				steps: [
					{ key: 'export', done: 0, total: 0, state: 'done' },
					{ key: 'textures', done: 3, total: 3, state: 'done' },
					{
						key: 'upload',
						done: 500_000,
						total: 2_000_000,
						state: 'active'
					},
					{ key: 'commit', done: 0, total: 0, state: 'waiting' }
				]
			}
		}

		it('names the running step and how far it has come', () => {
			renderPanel(uploadingGlb)

			expect(
				screen.getByRole('region', { name: 'Publish progress' })
			).toBeTruthy()
			expect(screen.getAllByText('Uploading the published file')).toBeTruthy()
			expect(
				screen.getByRole('progressbar').getAttribute('aria-valuenow')
			).toBe('25')
		})

		it('lists every step, and no settings when nothing was saved', () => {
			renderPanel(uploadingGlb)

			fireEvent.click(screen.getByRole('button', { name: 'Show save details' }))
			expect(screen.getByText('Compressing textures for the GPU')).toBeTruthy()
			expect(screen.getByText('Publishing')).toBeTruthy()
			expect(screen.queryByText('Scene settings')).toBeNull()
		})

		it('says how much of a bake is drawn as a share', () => {
			renderPanel({
				...uploadingGlb,
				publish: {
					steps: [
						{ key: 'export', done: 0, total: 0, state: 'done' },
						{ key: 'lights', done: 0.4, total: 1, state: 'active' },
						{ key: 'upload', done: 0, total: 0, state: 'waiting' }
					]
				}
			})

			fireEvent.click(screen.getByRole('button', { name: 'Show save details' }))
			expect(
				screen.getAllByText('Drawing the studio lights').length
			).toBeGreaterThan(0)
			expect(screen.getAllByText('40%').length).toBeGreaterThan(0)
			expect(
				screen.getByRole('progressbar').getAttribute('aria-valuenow')
			).toBe('40')
		})

		it('opens collapsed even when it starts with nothing to save', () => {
			const { store } = renderPanel({
				status: 'saved',
				message: null,
				files: []
			})
			fireEvent.click(screen.getByRole('button', { name: 'Show save details' }))
			expect(
				screen.getByRole('button', { name: 'Hide save details' })
			).toBeTruthy()

			act(() => store.set(savePanelAtom, uploadingGlb))

			expect(
				screen.getByRole('button', { name: 'Show save details' })
			).toBeTruthy()
		})

		it('leaves retrying a failed publish to the publish card', () => {
			renderPanel({
				...uploadingGlb,
				status: 'failed',
				message: 'Network'
			})

			expect(screen.queryByRole('button', { name: /Retry/ })).toBeNull()
		})
	})
})
