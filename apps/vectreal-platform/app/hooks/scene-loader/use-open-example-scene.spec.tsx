// @vitest-environment jsdom
/**
 * An upload resets the scene to its defaults once the model is in, so an
 * example's settings only survive if they go on after it, and only after a
 * load that worked. Applied as unsaved, so Save has something to do.
 */
import { renderHook } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { describe, expect, it, vi } from 'vitest'

import { useOpenExampleScene } from './use-open-example-scene'
import { exampleSceneById } from '../../lib/samples/example-scenes'
import { lastSavedSettingsAtom } from '../../lib/stores/publisher-config-store'
import { shadowsAtom } from '../../lib/stores/scene-settings-store'

import type { useSceneUpload } from './use-scene-upload'
import type { ReactNode } from 'react'

type UploadFiles = ReturnType<typeof useSceneUpload>['uploadFiles']

const example = exampleSceneById('camera-shadows')!
const file = new File([''], 'camera.glb')

function arrange(status: 'ready' | 'error') {
	const store = createStore()
	const uploadFiles = vi.fn(async () => {
		// What a real upload does once the model is in: back to the defaults.
		store.set(shadowsAtom, { enabled: false })
		return { status } as Awaited<ReturnType<UploadFiles>>
	}) as unknown as UploadFiles
	const wrapper = ({ children }: { children: ReactNode }) => (
		<Provider store={store}>{children}</Provider>
	)
	const { result } = renderHook(() => useOpenExampleScene(uploadFiles), {
		wrapper
	})
	return { store, uploadFiles, open: result.current }
}

describe('useOpenExampleScene', () => {
	it("loads the model, then puts the example's settings on top as unsaved", async () => {
		const { store, uploadFiles, open } = arrange('ready')

		await open(example, file)

		expect(uploadFiles).toHaveBeenCalledWith([file])
		expect(store.get(shadowsAtom).enabled).toBe(true)
		expect(store.get(shadowsAtom).contact?.enabled).toBe(true)
		expect(store.get(lastSavedSettingsAtom)).toBeNull()
	})

	it('applies nothing when the model did not load', async () => {
		const { store, open } = arrange('error')

		await open(example, file)

		expect(store.get(shadowsAtom).enabled).toBe(false)
	})
})
