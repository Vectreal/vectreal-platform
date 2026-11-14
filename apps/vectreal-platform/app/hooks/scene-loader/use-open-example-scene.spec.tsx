// @vitest-environment jsdom
/**
 * An upload resets the scene to its defaults once the model is in, so an
 * example's settings only survive if they go on after it, and only after a
 * load that worked and is still the current one. Applied as unsaved, so Save
 * has something to do.
 */
import { renderHook } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { describe, expect, it, vi } from 'vitest'

import { useOpenExampleScene } from './use-open-example-scene'
import { exampleSceneById } from '../../lib/samples/example-scenes'
import { sampleModelSource } from '../../lib/samples/sample-models'
import { lastSavedSettingsAtom } from '../../lib/stores/publisher-config-store'
import { shadowsAtom } from '../../lib/stores/scene-settings-store'

import type { useSceneUpload } from './use-scene-upload'
import type { ReactNode } from 'react'

type OpenModel = ReturnType<typeof useSceneUpload>['openModel']

const example = exampleSceneById('camera-shadows')!

function arrange(status: 'ready' | 'error', stillCurrent = true) {
	const store = createStore()
	const openModel = vi.fn(async () => {
		// What a real upload does once the model is in: back to the defaults.
		store.set(shadowsAtom, { enabled: false })
		return { status, stillCurrent: () => stillCurrent } as Awaited<
			ReturnType<OpenModel>
		>
	}) as unknown as OpenModel
	const wrapper = ({ children }: { children: ReactNode }) => (
		<Provider store={store}>{children}</Provider>
	)
	const { result } = renderHook(() => useOpenExampleScene(openModel), {
		wrapper
	})
	return { store, openModel, open: result.current }
}

describe('useOpenExampleScene', () => {
	it("loads the model, then puts the example's settings on top as unsaved", async () => {
		const { store, openModel, open } = arrange('ready')

		await open(example)

		// By its URL, so the download is the loader's own load.
		expect(openModel).toHaveBeenCalledWith(sampleModelSource(example.model))
		expect(store.get(shadowsAtom).enabled).toBe(true)
		expect(store.get(shadowsAtom).contact?.enabled).toBe(true)
		expect(store.get(lastSavedSettingsAtom)).toBeNull()
	})

	it('applies nothing when the model did not load', async () => {
		const { store, open } = arrange('error')

		await open(example)

		expect(store.get(shadowsAtom).enabled).toBe(false)
	})

	it('applies nothing when a newer load replaced it', async () => {
		const { store, open } = arrange('ready', false)

		await open(example)

		expect(store.get(shadowsAtom).enabled).toBe(false)
	})
})
