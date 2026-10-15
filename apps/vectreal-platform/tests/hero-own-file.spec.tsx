// @vitest-environment jsdom
/**
 * The hero's pass never syncs into the loader's viewer.
 *
 * The hero draws `getModel()`'s buffer on its own stage, so there is no loader
 * viewer to sync. The context's `applyOptimization` could not do it anyway: it
 * is read before the load, so on the first drop it belongs to no load and
 * rejects, which would fail every first drop.
 */
import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import HeroOwnFile, {
	type OwnFileApi
} from '../app/components/home/hero/hero-own-file'
import { balancedPreset } from '../app/constants/optimizations'
import { resolvePublishGeometryOptions } from '../app/lib/domain/scene/client/publish-export'

const { context, runOptimizationPass, projectPublishedGlbBytes } = vi.hoisted(
	() => ({
		projectPublishedGlbBytes: vi.fn(async () => 2),
		context: {
			load: vi.fn(async () => ({
				status: 'ready',
				file: { name: 'model.glb', sourcePackageBytes: 3 },
				stillCurrent: () => true
			})),
			optimizer: {
				getModel: vi.fn(async () => new Uint8Array([1, 2, 3])),
				applyOptimization: vi.fn(async () => {
					throw new Error('No model was ready when this optimizer was read.')
				})
			}
		},
		runOptimizationPass: vi.fn(async () => ({
			succeeded: true,
			dracoReport: null
		}))
	})
)

vi.mock('@vctrl/hooks/use-load-model', () => ({
	ModelProvider: ({ children }: { children: React.ReactNode }) => children,
	useModelContext: () => context
}))
vi.mock('@vctrl/hooks/use-optimize-model', () => ({
	useOptimizeModel: () => ({})
}))
vi.mock(
	'../app/components/publisher/optimization/run-optimization-pass',
	() => ({
		runOptimizationPass
	})
)
vi.mock(
	'../app/lib/domain/scene/client/publish-export',
	async (importOriginal) => ({
		...(await importOriginal<object>()),
		projectPublishedGlbBytes
	})
)
vi.mock('../app/hooks/scene-loader/use-scene-document-export', () => ({
	usePrepareGltfDocument: () => vi.fn()
}))
vi.mock('../app/lib/domain/scene/client/scene-draft-persistence', () => ({
	persistPendingSceneDraftOrchestrator: vi.fn()
}))
vi.mock('react-router', () => ({ useNavigate: () => vi.fn() }))

beforeEach(() => {
	vi.clearAllMocks()
})

async function ready(): Promise<OwnFileApi> {
	let api: OwnFileApi | null = null
	render(<HeroOwnFile onReady={(handed) => (api = handed)} />)
	await waitFor(() => expect(api).not.toBeNull())
	return api as unknown as OwnFileApi
}

describe('HeroOwnFile', () => {
	it('hands its pass a sync that leaves the loader alone', async () => {
		const api = await ready()

		await api.prepare([new File(['glb'], 'model.glb')])

		const [{ model }] = runOptimizationPass.mock.calls[0] as unknown as [
			{ model: { applyOptimization: () => Promise<unknown> } }
		]
		await expect(model.applyOptimization()).resolves.toBeUndefined()
		expect(context.optimizer.applyOptimization).not.toHaveBeenCalled()
	})

	// The sheet quotes what the file publishes at, measured as the publisher's card measures it.
	it('reports the size the prepared document publishes at', async () => {
		const api = await ready()

		const outcome = await api.prepare([new File(['glb'], 'model.glb')])

		expect(projectPublishedGlbBytes).toHaveBeenCalledWith(
			new Uint8Array([1, 2, 3]),
			resolvePublishGeometryOptions(balancedPreset, null)
		)
		expect(outcome).toMatchObject({ ok: true, bytes: 2, originalBytes: 3 })
	})

	it('keeps a prepared file whose size could not be projected', async () => {
		projectPublishedGlbBytes.mockRejectedValueOnce(new Error('worker crashed'))
		const api = await ready()

		const outcome = await api.prepare([new File(['glb'], 'model.glb')])

		expect(outcome).toMatchObject({ ok: true, bytes: 3 })
	})
})
