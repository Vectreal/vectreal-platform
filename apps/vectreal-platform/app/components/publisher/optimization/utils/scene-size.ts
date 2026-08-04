import { useExportModel } from '@vctrl/hooks/use-export-model'
import { useCallback } from 'react'

import type { SceneOptimizationRuntimeState } from '../../../../types/scene-optimization'
import type { DracoCompressionReport } from '@vctrl/core'
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

	/**
	 * @param dracoReport When Draco compression is in play, the working document
	 * is deliberately left uncompressed, so exporting it understates what will
	 * actually be published. The measured projection is the honest figure for
	 * the headline size and the plan size gate; the uncompressed export is kept
	 * alongside it as `workingSceneBytes`.
	 */
	const refreshOptimizedSizeInfo = useCallback(
		async (dracoReport?: DracoCompressionReport | null) => {
			const [sceneResult, textureResult] = await Promise.allSettled([
				calculateSceneBytes(),
				calculateOptimizedTextureBytes()
			])

			const updatedSceneBytes =
				sceneResult.status === 'fulfilled' ? sceneResult.value : null
			const updatedTextureBytes =
				textureResult.status === 'fulfilled' ? textureResult.value : null

			const workingSceneBytes =
				typeof updatedSceneBytes === 'number' ? updatedSceneBytes : null
			// The Draco report is measured in the geometry worker, before the
			// texture phase runs, so `projectedGlbBytes` still carries the original
			// images and using it directly erases every byte of texture saving from
			// the headline. Only the whole-file Draco delta survives the texture
			// phase: `uncompressedGlbBytes` and `projectedGlbBytes` are both a
			// `writeBinary` of the same document, so their textures cancel out.
			// Deliberately not `geometryBytesBefore - geometryBytesAfterCompression`
			// - those two count shared accessors differently (per-mesh vs. once
			// globally), and `dedup` runs right before `draco` in every preset.
			const dracoSaving = dracoReport
				? dracoReport.uncompressedGlbBytes - dracoReport.projectedGlbBytes
				: 0
			const publishedSceneBytes =
				dracoReport?.isWorthApplying && workingSceneBytes != null
					? Math.max(0, workingSceneBytes - dracoSaving)
					: workingSceneBytes

			setOptimizationRuntime((prev) => ({
				...prev,
				optimizedSceneBytes: publishedSceneBytes,
				workingSceneBytes,
				optimizedTextureBytes:
					typeof updatedTextureBytes === 'number'
						? updatedTextureBytes
						: typeof reportTexturesAfter === 'number'
							? reportTexturesAfter
							: null
			}))
		},
		[
			calculateOptimizedTextureBytes,
			calculateSceneBytes,
			reportTexturesAfter,
			setOptimizationRuntime
		]
	)

	return {
		calculateSceneBytes,
		calculateOptimizedTextureBytes,
		refreshOptimizedSizeInfo
	}
}
