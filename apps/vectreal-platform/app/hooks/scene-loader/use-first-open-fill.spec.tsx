// @vitest-environment jsdom
/**
 * A scene an agent saved is filled once on open: the ordinary save runs
 * after the opening frame, after the bake settles, and only on a scene the
 * user has not started editing.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useFirstOpenFill } from './use-first-open-fill'
import {
	currentSceneIdAtom,
	enterPreviewModeAtom,
	lastSavedSceneMetaAtom,
	lastSavedSettingsAtom,
	openingFramedAtom,
	saveLocationAtom
} from '../../lib/stores/publisher-config-store'

import type { SaveAvailabilityState } from '../../lib/domain/scene/client/scene-save-state'
import type { SceneSettings } from '@vctrl/core'
import type { ModelFile } from '@vctrl/hooks/use-load-model'
import type { ReactNode } from 'react'

const mocks = vi.hoisted(() => ({
	requestShadowBake: vi.fn(),
	waitForSettledBake: vi.fn(),
	file: { name: 'chair.glb' } as unknown
}))

vi.mock('@vctrl/hooks/use-load-model', () => ({
	useModelContext: () => ({ file: mocks.file })
}))

vi.mock('../../components/publisher/publisher-viewer-capture-context', () => ({
	usePublisherViewerCapture: () => ({
		requestShadowBake: mocks.requestShadowBake
	})
}))
vi.mock(
	'../../lib/domain/scene/client/first-open-fill',
	async (importOriginal) => ({
		...(await importOriginal<object>()),
		waitForSettledBake: mocks.waitForSettledBake
	})
)

const SCENE = 'scene-1'
const clean: SaveAvailabilityState = {
	canSave: false,
	reason: 'no-unsaved-changes'
}
const dirty: SaveAvailabilityState = { canSave: true, reason: 'ready' }
const target = { targetProjectId: 'p1', targetFolderId: null }

function setup({
	thumbnailUrl = '',
	shadows = { enabled: false } as SceneSettings['shadows'],
	framed = true,
	preview = false,
	availability = clean,
	pickedProjectId = undefined as string | undefined
} = {}) {
	const store = createStore()
	store.set(currentSceneIdAtom, SCENE)
	store.set(
		openingFramedAtom,
		framed ? { sceneId: SCENE, file: mocks.file as ModelFile } : null
	)
	store.set(lastSavedSceneMetaAtom, {
		name: 'Chair',
		description: '',
		thumbnailUrl
	})
	store.set(lastSavedSettingsAtom, { shadows })
	if (preview) store.set(enterPreviewModeAtom)
	if (pickedProjectId) {
		store.set(saveLocationAtom, {
			targetProjectId: pickedProjectId,
			targetFolderId: null
		})
	}
	const saveSceneSettings = vi.fn(async () => undefined)
	const wrapper = ({ children }: { children: ReactNode }) => (
		<Provider store={store}>{children}</Provider>
	)
	const hook = renderHook(
		({ saveAvailability }: { saveAvailability: SaveAvailabilityState }) =>
			useFirstOpenFill({
				saveSceneSettings,
				saveAvailability,
				saveLocationTarget: target
			}),
		{ wrapper, initialProps: { saveAvailability: availability } }
	)
	return { store, saveSceneSettings, hook }
}

beforeEach(() => {
	mocks.waitForSettledBake.mockReset().mockResolvedValue(true)
})

describe('useFirstOpenFill', () => {
	it('saves a scene with no thumbnail once, to its current location, without waiting for a bake when shadows are off', async () => {
		const { saveSceneSettings, hook } = setup()

		await waitFor(() => expect(saveSceneSettings).toHaveBeenCalledTimes(1))
		expect(saveSceneSettings).toHaveBeenCalledWith(target)
		expect(mocks.waitForSettledBake).not.toHaveBeenCalled()

		hook.rerender({ saveAvailability: dirty })
		hook.rerender({ saveAvailability: clean })
		await act(async () => undefined)
		expect(saveSceneSettings).toHaveBeenCalledTimes(1)
	})

	it('waits for the bake to settle before saving a scene with shadows on and no bake', async () => {
		const { saveSceneSettings } = setup({
			thumbnailUrl: '/api/scenes/scene-1/thumbnail/a1',
			shadows: { enabled: true }
		})

		await waitFor(() => expect(saveSceneSettings).toHaveBeenCalledTimes(1))
		expect(mocks.waitForSettledBake).toHaveBeenCalledWith(
			mocks.requestShadowBake,
			expect.objectContaining({ isCancelled: expect.any(Function) })
		)
		expect(mocks.waitForSettledBake.mock.invocationCallOrder[0]).toBeLessThan(
			saveSceneSettings.mock.invocationCallOrder[0]
		)
	})

	it("waits for the opening frame of this scene's model", async () => {
		const { store, saveSceneSettings } = setup({ framed: false })
		await act(async () => undefined)
		expect(saveSceneSettings).not.toHaveBeenCalled()

		// The previous scene's model framing late does not count.
		act(() =>
			store.set(openingFramedAtom, {
				sceneId: SCENE,
				file: { name: 'previous.glb' } as unknown as ModelFile
			})
		)
		await act(async () => undefined)
		expect(saveSceneSettings).not.toHaveBeenCalled()

		act(() =>
			store.set(openingFramedAtom, {
				sceneId: SCENE,
				file: mocks.file as ModelFile
			})
		)

		await waitFor(() => expect(saveSceneSettings).toHaveBeenCalledTimes(1))
	})

	it('does nothing for a scene that has both, in preview, with unsaved changes, or with a picked location', async () => {
		const filled = setup({
			thumbnailUrl: '/api/scenes/scene-1/thumbnail/a1',
			shadows: { enabled: true, baked: { assetId: 'b1', signature: 'v2:1' } }
		})
		const previewing = setup({ preview: true })
		const editing = setup({ availability: dirty })
		const moving = setup({ pickedProjectId: 'p2' })
		await act(async () => undefined)

		expect(filled.saveSceneSettings).not.toHaveBeenCalled()
		expect(previewing.saveSceneSettings).not.toHaveBeenCalled()
		expect(editing.saveSceneSettings).not.toHaveBeenCalled()
		expect(moving.saveSceneSettings).not.toHaveBeenCalled()
	})

	it('fills once the scene is clean again, when it opened with unsaved changes', async () => {
		const { saveSceneSettings, hook } = setup({ availability: dirty })
		await act(async () => undefined)
		expect(saveSceneSettings).not.toHaveBeenCalled()

		hook.rerender({ saveAvailability: clean })

		await waitFor(() => expect(saveSceneSettings).toHaveBeenCalledTimes(1))
	})

	it('leaves the save to the user when they edit while the bake settles', async () => {
		let settle: (settled: boolean) => void = () => undefined
		mocks.waitForSettledBake.mockReturnValue(
			new Promise<boolean>((resolve) => {
				settle = resolve
			})
		)
		const { saveSceneSettings, hook } = setup({ shadows: { enabled: true } })
		await waitFor(() => expect(mocks.waitForSettledBake).toHaveBeenCalled())

		hook.rerender({ saveAvailability: dirty })
		await act(async () => settle(true))

		expect(saveSceneSettings).not.toHaveBeenCalled()
	})

	it('leaves the save to the user when they pick a location or enter preview while the bake settles', async () => {
		for (const change of [
			(store: ReturnType<typeof createStore>) =>
				store.set(saveLocationAtom, {
					targetProjectId: 'p2',
					targetFolderId: null
				}),
			(store: ReturnType<typeof createStore>) => store.set(enterPreviewModeAtom)
		]) {
			let settle: (settled: boolean) => void = () => undefined
			mocks.waitForSettledBake.mockReturnValueOnce(
				new Promise<boolean>((resolve) => {
					settle = resolve
				})
			)
			const { store, saveSceneSettings } = setup({ shadows: { enabled: true } })
			await waitFor(() => expect(mocks.waitForSettledBake).toHaveBeenCalled())

			act(() => change(store))
			await act(async () => settle(true))

			expect(saveSceneSettings).not.toHaveBeenCalled()
			mocks.waitForSettledBake.mockClear()
		}
	})

	it('waits while no model is loaded, even when the viewer framed nothing', async () => {
		const loaded = mocks.file
		mocks.file = null
		try {
			const { store, saveSceneSettings } = setup({ framed: false })
			act(() => store.set(openingFramedAtom, { sceneId: SCENE, file: null }))
			await act(async () => undefined)
			expect(saveSceneSettings).not.toHaveBeenCalled()
		} finally {
			mocks.file = loaded
		}
	})

	it('saves nothing once the publisher has unmounted during the wait', async () => {
		let settle: (settled: boolean) => void = () => undefined
		mocks.waitForSettledBake.mockReturnValue(
			new Promise<boolean>((resolve) => {
				settle = resolve
			})
		)
		const { saveSceneSettings, hook } = setup({ shadows: { enabled: true } })
		await waitFor(() => expect(mocks.waitForSettledBake).toHaveBeenCalled())

		hook.unmount()
		await act(async () => settle(false))

		expect(saveSceneSettings).not.toHaveBeenCalled()
	})

	it('saves a missing thumbnail when the bake never settles, and nothing when only the bake was missing', async () => {
		mocks.waitForSettledBake.mockResolvedValue(false)
		const thumbless = setup({ shadows: { enabled: true } })
		const bakeOnly = setup({
			thumbnailUrl: '/api/scenes/scene-1/thumbnail/a1',
			shadows: { enabled: true }
		})

		await waitFor(() =>
			expect(thumbless.saveSceneSettings).toHaveBeenCalledTimes(1)
		)
		await act(async () => undefined)
		expect(bakeOnly.saveSceneSettings).not.toHaveBeenCalled()
	})
})
