// @vitest-environment jsdom
/**
 * Adding the studio finish previews it as soon as the model can take it, and
 * forgets that once the finish is turned off again, so a later model load
 * never starts a preview nobody asked for.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { LIGHTING_SETUPS } from '@vctrl/core'
import { ModelProvider } from '@vctrl/hooks/use-load-model'
import { createStore, Provider } from 'jotai'
import { useAtomValue } from 'jotai/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import LightingSettings from './lighting-settings-panel'
import { lightingAtom } from '../../../../../lib/stores/scene-settings-store'

const model = vi.hoisted(() => ({ loaded: false, bake: vi.fn() }))

// The preview hook, reduced to what the panel reads: whether the lighting
// asks for a finish, and whether a model is there to draw it on.
vi.mock('./use-bake-preview', async (original) => {
	const actual = await original<typeof import('./use-bake-preview')>()
	const { publishBakes } =
		await import('../../../../../lib/domain/scene/client/publish-export')
	return {
		...actual,
		useBakePreview: () => {
			const bakes = publishBakes(useAtomValue(lightingAtom))
			const bakesAnything = bakes.occlusion || Boolean(bakes.lights)
			return {
				preview: null,
				canBake: model.loaded && bakesAnything,
				bakesAnything,
				isOptimizing: false,
				isAnimated: false,
				bake: model.bake,
				setShown: () => {}
			}
		}
	}
})

globalThis.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
}

const overcast = LIGHTING_SETUPS.find((setup) => setup.id === 'overcast')!

const renderPanel = () => {
	const store = createStore()
	store.set(lightingAtom, overcast.lighting)
	const view = render(
		<Provider store={store}>
			<ModelProvider>
				<LightingSettings />
			</ModelProvider>
		</Provider>
	)
	const rerender = () =>
		view.rerender(
			<Provider store={store}>
				<ModelProvider>
					<LightingSettings />
				</ModelProvider>
			</Provider>
		)
	return { store, rerender }
}

beforeEach(() => {
	model.loaded = false
	model.bake.mockClear()
})

describe('the preview queued by adding the studio finish', () => {
	it('draws once a model can take it', () => {
		const { rerender } = renderPanel()
		fireEvent.click(screen.getByRole('button', { name: 'Add studio finish' }))
		expect(model.bake).not.toHaveBeenCalled()
		model.loaded = true
		act(() => rerender())
		expect(model.bake).toHaveBeenCalledTimes(1)
	})

	it('is dropped when the finish is turned off before it could draw', () => {
		const { store, rerender } = renderPanel()
		fireEvent.click(screen.getByRole('button', { name: 'Add studio finish' }))
		act(() =>
			store.set(lightingAtom, (prev) => ({
				...prev,
				occlusion: { ...prev.occlusion, mode: 'live' }
			}))
		)
		act(() =>
			store.set(lightingAtom, (prev) => ({
				...prev,
				occlusion: { ...prev.occlusion, mode: 'baked' }
			}))
		)
		model.loaded = true
		act(() => rerender())
		expect(model.bake).not.toHaveBeenCalled()
	})
})
