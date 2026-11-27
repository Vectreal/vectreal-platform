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

import type { ReactElement } from 'react'

const { load, resetSceneState, loader, posthog } = vi.hoisted(() => ({
	load: vi.fn(),
	resetSceneState: vi.fn(),
	// One client, as the real hook returns.
	posthog: { capture: vi.fn() },
	// The loader's rendered state, which the subject is read against.
	loader: { status: 'loading', source: 'url' } as {
		status: string
		source: string | null
	}
}))

vi.mock('@vctrl/hooks/use-load-model', async (importActual) => ({
	...(await importActual<typeof import('@vctrl/hooks/use-load-model')>()),
	useModelContext: () => ({ load, ...loader })
}))
vi.mock('./use-scene-settings', () => ({
	useResetSceneState: () => resetSceneState
}))
// No analytics consent: the banner has not been answered.
vi.mock('../../components/consent/consent-context', () => ({
	useConsent: () => ({ consent: null })
}))
vi.mock('../../lib/posthog/posthog-react', () => ({
	usePostHog: () => posthog
}))
vi.mock('../../lib/persistence/pending-scene-idb', () => ({
	clearPendingSceneDraft: vi.fn(async () => undefined)
}))
vi.mock('sonner', () => ({
	toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() }
}))

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
	Object.assign(loader, { status: 'loading', source: 'url' })
	resetSceneState.mockReset()
	posthog.capture.mockReset()
	vi.mocked(toast.error).mockReset()
	vi.mocked(toast.success).mockReset()
	vi.mocked(toast.warning).mockReset()
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

	/*
	  A load is a step of the funnel counted without consent
	  (`cookieless-events.ts`); a refusal carries the loader's message and is
	  sent only with consent.
	*/
	it('reports a model that loaded without analytics consent, not a refusal', async () => {
		load.mockResolvedValueOnce(outcome('ready'))
		load.mockResolvedValueOnce(outcome('error', { error: new Error('bad') }))
		const { result } = renderHook(() => useSceneUpload())

		await act(() => result.current.openModel(SOURCE))
		await act(() => result.current.openModel(SOURCE))

		expect(posthog.capture.mock.calls.map(([event]) => event)).toEqual([
			'scene_upload_succeeded'
		])
		expect(posthog.capture.mock.calls[0][1]).toMatchObject({
			file_format: 'glb'
		})
	})

	// A name without a known extension is the visitor's own words.
	it('reports the format, never the file name', async () => {
		load.mockResolvedValue({
			...outcome('ready'),
			file: { name: 'Jane Doe living room' }
		})
		const { result } = renderHook(() => useSceneUpload())

		await act(() => result.current.openModel(SOURCE))

		expect(posthog.capture.mock.calls[0][1]).toMatchObject({
			file_format: 'unknown'
		})
	})

	it('says which images a glTF opened without, in place of "Loaded"', async () => {
		load.mockResolvedValue({
			...outcome('ready'),
			file: { name: 'scene.gltf', missingTextures: ['textures/wood.png'] }
		})
		const { result } = renderHook(() => useSceneUpload())

		await act(() =>
			result.current.openModel({ kind: 'files', files: [] as File[] })
		)

		expect(resetSceneState).toHaveBeenCalledTimes(1)
		expect(toast.success).not.toHaveBeenCalled()
		expect(toast.warning).toHaveBeenCalledWith(
			'scene.gltf opened without textures/wood.png, which did not come with it, so those surfaces show their plain color. To see them textured, drop the whole folder it lives in.'
		)
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

	it('sends someone who dropped photos to the free-model offer', async () => {
		const error = {
			code: 'unsupported_format',
			message: 'No supported model found',
			source: 'local-upload',
			context: { selection: { kind: 'photos' } }
		}
		load.mockResolvedValue(outcome('error', { error }))
		const { result } = renderHook(() => useSceneUpload())

		await act(() => result.current.openModel(SOURCE))

		const { description } = vi.mocked(toast.error).mock.calls[0][1] as {
			description: ReactElement<{ to: string }>
		}
		expect(description.props.to).toBe('/free-model')
	})

	it('carries no link on any other refusal', async () => {
		const error = {
			code: 'unsupported_format',
			message: 'No supported model found',
			source: 'local-upload',
			context: { selection: null }
		}
		load.mockResolvedValue(outcome('error', { error }))
		const { result } = renderHook(() => useSceneUpload())

		await act(() => result.current.openModel(SOURCE))

		expect(vi.mocked(toast.error).mock.calls[0][1]).toBeUndefined()
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

	it('does not name a saved scene that superseded the open, while the open still parses', () => {
		load.mockReturnValue(new Promise(() => undefined))
		const { result, rerender } = renderHook(() => useSceneUpload())

		act(() => {
			void result.current.openModel(SOURCE, { label: 'Rocket' })
		})
		expect(result.current.subject).toBe('Rocket')

		Object.assign(loader, { source: 'server' })
		rerender()
		expect(result.current.subject).toBeNull()
	})

	it('forgets the name once the open ends, even superseded', async () => {
		load.mockResolvedValue(outcome('empty', { current: false }))
		const { result } = renderHook(() => useSceneUpload())

		await act(() => result.current.openModel(SOURCE, { label: 'Rocket' }))

		expect(result.current.subject).toBeNull()
	})

	it('keeps the name of a newer open over the one it superseded', async () => {
		let finishFirst: (value: unknown) => void = () => undefined
		load
			.mockReturnValueOnce(new Promise((resolve) => (finishFirst = resolve)))
			.mockReturnValueOnce(new Promise(() => undefined))
		const { result } = renderHook(() => useSceneUpload())

		let first: Promise<unknown> = Promise.resolve()
		act(() => {
			first = result.current.openModel(SOURCE, { label: 'Rocket' })
		})
		act(() => {
			void result.current.openModel(SOURCE, { label: 'Camera' })
		})
		await act(async () => {
			finishFirst(outcome('empty', { current: false }))
			await first
		})

		expect(result.current.subject).toBe('Camera')
	})
})
