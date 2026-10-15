// @vitest-environment jsdom
/**
 * The save panel reports how a save went, so the save action toasts only what
 * the panel cannot show: a failure while the publish panel covers it.
 */
import { act, renderHook } from '@testing-library/react'
import { createStore, Provider } from 'jotai'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { usePublisherSaveAction } from './use-publisher-save-action'
import {
	enterPreviewModeAtom,
	processAtom
} from '../lib/stores/publisher-config-store'

import type { ReactNode } from 'react'

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

beforeEach(() => {
	toastError.mockReset()
	vi.spyOn(console, 'error').mockImplementation(() => {})
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
