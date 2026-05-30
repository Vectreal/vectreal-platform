import { useExportModel } from '@vctrl/hooks/use-export-model'
import { useCallback } from 'react'

import type { SceneOptimizationRuntimeState } from '../../../../types/scene-optimization'
import type { ModelFile } from '@vctrl/hooks/use-load-model'
import type { useOptimizeModel } from '@vctrl/hooks/use-optimize-model'

type Optimizer = ReturnType<typeof useOptimizeModel>
type UpdateRuntime = (
	updater: (
		prev: SceneOptimizationRuntimeState
	) => SceneOptimizationRuntimeState
) => void

/**
 * Sub-hook that encapsulates the three scene/texture size calculation callbacks.
 * Extracted to reduce the size of useOptimizationProcess.
 */
export function useSceneSizeCalculator(
	optimizer: Optimizer,
	file: ModelFile | null,
	isReady: boolean,
	reportTexturesAfter: number | undefined,
	setOptimizationRuntime: UpdateRuntime
) {
	const { handleDocumentGltfExport } = useExportModel()

	const calculateSceneBytes = useCallback(async () => {
		if (!isReady) return null
		const exportedGlb = await optimizer.getModel()
		if (!exportedGlb) return null
		return exportedGlb.byteLength
	}, [isReady, optimizer])

	const calculateOptimizedTextureBytes = useCallback(async () => {
		if (!isReady) return null

		const gltfDocument = optimizer._getDocument()
		if (!gltfDocument) return null

		const exported = await handleDocumentGltfExport(
			gltfDocument,
			file ?? null,
			false,
			false
		)

		if (!exported || typeof exported !== 'object' || !('assets' in exported)) {
			return null
		}

		const assets = exported.assets
		if (!(assets instanceof Map)) return null

		let textureBytes = 0
		for (const [fileName, data] of assets.entries()) {
			if (/\.(png|jpe?g|webp|ktx2?)$/i.test(fileName)) {
				textureBytes += data.byteLength
			}
		}

		return textureBytes
	}, [isReady, optimizer, handleDocumentGltfExport, file])

	const refreshOptimizedSizeInfo = useCallback(async () => {
		const [sceneResult, textureResult] = await Promise.allSettled([
			calculateSceneBytes(),
			calculateOptimizedTextureBytes()
		])

		const updatedSceneBytes =
			sceneResult.status === 'fulfilled' ? sceneResult.value : null
		const updatedTextureBytes =
			textureResult.status === 'fulfilled' ? textureResult.value : null

		setOptimizationRuntime((prev) => ({
			...prev,
			optimizedSceneBytes:
				typeof updatedSceneBytes === 'number' ? updatedSceneBytes : null,
			optimizedTextureBytes:
				typeof updatedTextureBytes === 'number'
					? updatedTextureBytes
					: typeof reportTexturesAfter === 'number'
						? reportTexturesAfter
						: null
		}))
	}, [
		calculateOptimizedTextureBytes,
		calculateSceneBytes,
		reportTexturesAfter,
		setOptimizationRuntime
	])

	return {
		calculateSceneBytes,
		calculateOptimizedTextureBytes,
		refreshOptimizedSizeInfo
	}
}
