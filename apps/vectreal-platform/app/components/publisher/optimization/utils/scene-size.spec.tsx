// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useSceneSizeCalculator } from './scene-size'
import { optimizationRuntimeInitialState } from '../../../../lib/stores/scene-optimization-store'

import type { SceneOptimizationRuntimeState } from '../../../../types/scene-optimization'

vi.mock('@vctrl/hooks/use-export-model', () => ({
	useExportModel: () => ({
		handleDocumentGltfExport: async () => ({ assets: new Map() })
	})
}))

describe('measuring a new optimization pass', () => {
	it('forgets the last publish, which no longer describes the document', async () => {
		const optimizer = {
			getModel: async () => new Uint8Array(10),
			_getDocument: () => ({})
		}
		const { result } = renderHook(() =>
			useSceneSizeCalculator(optimizer as never, null, true, undefined)
		)
		let runtime: SceneOptimizationRuntimeState = {
			...optimizationRuntimeInitialState,
			optimizedSceneBytes: 900,
			publishedEncoding: { geometryCodec: 'meshopt' }
		}

		await result.current.refreshOptimizedSizeInfo(null, (update) => {
			runtime = update(runtime)
		})

		expect(runtime.optimizedSceneBytes).toBe(10)
		expect(runtime.publishedEncoding).toBeNull()
	})
})
