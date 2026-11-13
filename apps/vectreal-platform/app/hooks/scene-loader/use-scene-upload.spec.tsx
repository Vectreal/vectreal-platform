// @vitest-environment jsdom
/**
 * Adding a model to the stage: what happens once the loader answers.
 *
 * A URL now goes to the loader as a URL, so its download can be superseded by
 * a drop or reset mid-way like any load. Only the load still on the stage may
 * replace the scene, and a cancelled one says nothing.
 */
import { act, renderHook } from '@testing-library/react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSceneUpload } from './use-scene-upload'

const { load, resetSceneState } = vi.hoisted(() => ({
	load: vi.fn(),
	resetSceneState: vi.fn()
}))

vi.mock('@vctrl/hooks/use-load-model', () => ({
	useModelContext: () => ({ load })
}))
vi.mock('./use-scene-settings', () => ({
	useResetSceneState: () => resetSceneState
}))
vi.mock('../../components/consent/consent-context', () => ({
	useConsent: () => ({ consent: null })
}))
vi.mock('../../lib/posthog/posthog-react', () => ({ usePostHog: () => null }))
vi.mock('../../lib/persistence/pending-scene-idb', () => ({
	clearPendingSceneDraft: vi.fn(async () => undefined)
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const SOURCE = { kind: 'url', url: '/rocket.glb' } as const
const outcome = (
	status: string,
	{ current = true, error = null as unknown } = {}
) => ({
	status,
	error,
	file: { name: 'rocket.glb' },
	stillCurrent: () => current
})

beforeEach(() => {
	load.mockReset()
	resetSceneState.mockReset()
	vi.mocked(toast.error).mockReset()
	vi.mocked(toast.success).mockReset()
})

describe('useSceneUpload', () => {
	it('replaces the scene with a model that loaded', async () => {
		load.mockResolvedValue(outcome('ready'))
		const { result } = renderHook(() => useSceneUpload())

		await act(() => result.current.openModel(SOURCE))

		expect(load).toHaveBeenCalledWith(SOURCE)
		expect(resetSceneState).toHaveBeenCalledTimes(1)
		expect(toast.success).toHaveBeenCalledWith('Loaded rocket.glb')
	})

	it('leaves the scene to a newer load that took the stage', async () => {
		load.mockResolvedValue(outcome('ready', { current: false }))
		const { result } = renderHook(() => useSceneUpload())

		await act(() => result.current.openModel(SOURCE))

		expect(resetSceneState).not.toHaveBeenCalled()
		expect(toast.success).not.toHaveBeenCalled()
	})

	it('says nothing about a load that was cancelled', async () => {
		load.mockResolvedValue(outcome('empty'))
		const { result } = renderHook(() => useSceneUpload())

		await act(() => result.current.openModel(SOURCE))

		expect(toast.error).not.toHaveBeenCalled()
		expect(resetSceneState).not.toHaveBeenCalled()
	})

	it("says a failure in the caller's words where it has some, else the loader's", async () => {
		const error = { code: 'url_http', message: 'answered 503' }
		load.mockResolvedValue(outcome('error', { error }))
		const { result } = renderHook(() => useSceneUpload())

		await act(() =>
			result.current.openModel(SOURCE, { failureMessage: () => 'Try again.' })
		)
		await act(() =>
			result.current.openModel(SOURCE, { failureMessage: () => null })
		)

		expect(vi.mocked(toast.error).mock.calls[0][0]).toBe('Try again.')
		expect(vi.mocked(toast.error).mock.calls[1][0]).not.toBe('Try again.')
	})

	it('names what is opening while it loads, and forgets it once it lands', async () => {
		let finish: (value: unknown) => void = () => undefined
		load.mockReturnValue(new Promise((resolve) => (finish = resolve)))
		const { result } = renderHook(() => useSceneUpload())

		let opening: Promise<unknown> = Promise.resolve()
		act(() => {
			opening = result.current.openModel(SOURCE, { label: 'Rocket' })
		})
		expect(result.current.subject).toBe('Rocket')

		await act(async () => {
			finish(outcome('ready'))
			await opening
		})
		expect(result.current.subject).toBeNull()
	})
})
