// @vitest-environment jsdom
/**
 * The save panel reports how a save went, so the save action toasts only what
 * the panel cannot show: a failure while the publish panel covers it.
 */
import { format } from 'node:util'

import { act, renderHook } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { usePublisherSaveAction } from './use-publisher-save-action'
import {
	enterPreviewModeAtom,
	processAtom
} from '../lib/stores/publisher-config-store'
import { dispatchSaveProgressAtom } from '../lib/stores/save-progress-store'

import type { ReactNode } from 'react'
import type { MockInstance } from 'vitest'

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))

vi.mock('sonner', () => ({ toast: { error: toastError } }))
vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }))

const setPublishPanel = (
	store: ReturnType<typeof createStore>,
	isOpen: boolean
) => store.set(processAtom, (prev) => ({ ...prev, showPublishPanel: isOpen }))

/** Fails a save, with the publish panel open or closed when it fails. */
const runFailingSave = async ({
	openAtStart,
	openAtFailure,
	previewAtFailure = false
}: {
	openAtStart: boolean
	openAtFailure: boolean
	previewAtFailure?: boolean
}) => {
	const store = createStore()
	setPublishPanel(store, openAtStart)
	const wrapper = ({ children }: { children: ReactNode }) => (
		<Provider store={store}>{children}</Provider>
	)
	const { result } = renderHook(
		() =>
			usePublisherSaveAction({
				sceneId: 's1',
				userId: 'u1',
				saveSceneSettings: async () => {
					setPublishPanel(store, openAtFailure)
					if (previewAtFailure) store.set(enterPreviewModeAtom)
					throw new Error('disk full')
				}
			}),
		{ wrapper }
	)
	await act(() => result.current.handleSaveScene())
}

let consoleError: MockInstance<typeof console.error>
beforeEach(() => {
	toastError.mockReset()
	consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
	/* A failed save is logged. That, and nothing else. */
	for (const args of consoleError.mock.calls) {
		expect(format(...args)).toMatch(/^Error saving scene settings:/)
	}
})

describe('usePublisherSaveAction', () => {
	it('leaves a failure to the save panel while the panel is in view', async () => {
		await runFailingSave({ openAtStart: true, openAtFailure: false })

		expect(toastError).not.toHaveBeenCalled()
	})

	it('toasts a failure while the publish panel covers the save panel', async () => {
		await runFailingSave({ openAtStart: false, openAtFailure: true })

		expect(toastError).toHaveBeenCalledWith(
			expect.stringContaining('disk full')
		)
	})

	it('does not start a save while a publish runs its own', async () => {
		const store = createStore()
		store.set(dispatchSaveProgressAtom, {
			type: 'publish-started',
			saves: false
		})
		const saveSceneSettings = vi.fn()
		const wrapper = ({ children }: { children: ReactNode }) => (
			<Provider store={store}>{children}</Provider>
		)
		const { result } = renderHook(
			() =>
				usePublisherSaveAction({
					sceneId: 's1',
					userId: 'u1',
					saveSceneSettings
				}),
			{ wrapper }
		)

		await act(() => result.current.handleSaveScene())

		expect(saveSceneSettings).not.toHaveBeenCalled()
	})

	it('toasts a failure while preview mode hides the save panel', async () => {
		await runFailingSave({
			openAtStart: false,
			openAtFailure: false,
			previewAtFailure: true
		})

		expect(toastError).toHaveBeenCalledWith(
			expect.stringContaining('disk full')
		)
	})
})
