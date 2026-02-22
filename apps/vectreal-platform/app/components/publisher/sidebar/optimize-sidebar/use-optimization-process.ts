import { useExportModel } from '@vctrl/hooks/use-export-model'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtom, useAtomValue } from 'jotai'
import { useCallback, useEffect, useRef } from 'react'

import {
	optimizationAtom,
	optimizationRuntimeAtom
} from '../../../../lib/stores/scene-optimization-store'

import type {
	DedupOptimization,
	NormalsOptimization,
	QuantizeOptimization,
	SimplificationOptimization,
	TextureOptimization
} from '@vctrl/core'

export type SizeInfo = {
	initialSceneBytes?: number | null
	currentSceneBytes?: number | null
	initialTextureBytes?: number | null
	currentTextureBytes?: number | null
}

type OptimizationOption =
	| SimplificationOptimization
	| TextureOptimization
	| QuantizeOptimization
	| DedupOptimization
	| NormalsOptimization

/**
 * Custom hook that encapsulates the optimization logic and state management
 */
export const useOptimizationProcess = () => {
	const { optimizer, on, off, file } = useModelContext(true)
	const { handleDocumentGltfExport } = useExportModel()
	const {
		reset: resetOptimize,
		applyOptimization,
		simplifyOptimization,
		texturesOptimization,
		quantizeOptimization,
		dedupOptimization,
		normalsOptimization,
		info,
		report
	} = optimizer

	const { optimizations: plannedOptimizations } = useAtomValue(optimizationAtom)
	const [optimizationRuntime, setOptimizationRuntime] = useAtom(
		optimizationRuntimeAtom
	)
	const {
		isPending,
		optimizedSceneBytes,
		clientSceneBytes,
		optimizedTextureBytes,
		clientTextureBytes,
		latestSceneStats
	} = optimizationRuntime
	const isSceneSizeCalculationInFlightRef = useRef(false)

	const calculateSceneBytes = useCallback(async () => {
		const exportedGlb = await optimizer.getModel()
		if (!exportedGlb) return null
		return exportedGlb.byteLength
	}, [optimizer])

	const calculateOptimizedTextureBytes = useCallback(async () => {
		if (!optimizer?._getDocument?.()) {
			return null
		}

		const gltfDocument = optimizer._getDocument()
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
		if (!(assets instanceof Map)) {
			return null
		}

		let textureBytes = 0
		for (const [fileName, data] of assets.entries()) {
			if (/\.(png|jpe?g|webp|ktx2?)$/i.test(fileName)) {
				textureBytes += data.byteLength
			}
		}

		return textureBytes
	}, [optimizer, handleDocumentGltfExport, file])

	// Handle optimization process
	const handleOptimizeClick = useCallback(async () => {
		if (isPending) return

		setOptimizationRuntime((prev) => ({
			...prev,
			isPending: true
		}))

		try {
			if (typeof clientSceneBytes !== 'number') {
				const baselineSceneBytes =
					typeof file?.sourcePackageBytes === 'number'
						? file.sourcePackageBytes
						: typeof latestSceneStats?.currentSceneBytes === 'number'
							? latestSceneStats.currentSceneBytes
							: await calculateSceneBytes()
				if (typeof baselineSceneBytes === 'number') {
					setOptimizationRuntime((prev) => ({
						...prev,
						clientSceneBytes: baselineSceneBytes
					}))
				}
			}

			if (typeof clientTextureBytes !== 'number') {
				const baselineTextureBytes =
					typeof file?.sourceTextureBytes === 'number'
						? file.sourceTextureBytes
						: (report?.stats.textures.before ?? null)
				if (typeof baselineTextureBytes === 'number') {
					setOptimizationRuntime((prev) => ({
						...prev,
						clientTextureBytes: baselineTextureBytes
					}))
				}
			}

			const optimizationOptions = Object.values(plannedOptimizations).filter(
				(option): option is OptimizationOption => !!option && option.enabled
			)

			for (let i = 0; i < optimizationOptions.length; i++) {
				const option = optimizationOptions[i]

				try {
					// Apply single optimization based on option type
					if (option.name === 'simplification') {
						await simplifyOptimization(option)
					} else if (option.name === 'texture') {
						await texturesOptimization(option)
					} else if (option.name === 'quantize') {
						await quantizeOptimization()
					} else if (option.name === 'dedup') {
						await dedupOptimization()
					} else if (option.name === 'normals') {
						await normalsOptimization()
					} else {
						// Use explicit type casting for exhaustiveness check
						const unknownOption = option as OptimizationOption
						console.warn(`Unknown optimization type: ${unknownOption.name}`)
					}

					// Let UI update between optimizations
					await new Promise<void>((resolve) =>
						requestAnimationFrame(() => setTimeout(() => resolve(), 0))
					)
				} catch (error) {
					console.error(`Error processing ${option.name}:`, error)
				}
			}

			// Apply all optimizations
			await applyOptimization()
			const [updatedSceneBytes, updatedTextureBytes] = await Promise.all([
				calculateSceneBytes(),
				calculateOptimizedTextureBytes()
			])
			setOptimizationRuntime((prev) => ({
				...prev,
				optimizedSceneBytes:
					typeof updatedSceneBytes === 'number' ? updatedSceneBytes : null,
				optimizedTextureBytes:
					typeof updatedTextureBytes === 'number'
						? updatedTextureBytes
						: typeof report?.stats.textures.after === 'number'
							? report.stats.textures.after
							: null
			}))
		} catch (error) {
			console.error('Error during optimization:', error)
		} finally {
			setOptimizationRuntime((prev) => ({
				...prev,
				isPending: false
			}))
		}
	}, [
		isPending,
		clientSceneBytes,
		clientTextureBytes,
		latestSceneStats,
		calculateSceneBytes,
		calculateOptimizedTextureBytes,
		setOptimizationRuntime,
		plannedOptimizations,
		applyOptimization,
		simplifyOptimization,
		texturesOptimization,
		quantizeOptimization,
		dedupOptimization,
		normalsOptimization,
		file?.sourcePackageBytes,
		file?.sourceTextureBytes,
		report?.stats.textures.before,
		report?.stats.textures.after
	])

	useEffect(() => {
		if (typeof clientTextureBytes === 'number') {
			return
		}

		if (typeof file?.sourceTextureBytes !== 'number') {
			return
		}

		setOptimizationRuntime((prev) => ({
			...prev,
			clientTextureBytes: file.sourceTextureBytes ?? null
		}))
	}, [clientTextureBytes, file?.sourceTextureBytes, setOptimizationRuntime])

	// Reset on model load
	useEffect(() => {
		const handleReset = () => {
			setOptimizationRuntime((prev) => ({
				...prev,
				isPending: false,
				optimizedSceneBytes: null,
				clientSceneBytes: null,
				optimizedTextureBytes: null,
				clientTextureBytes: null
			}))
		}
		on('load-start', resetOptimize)
		on('load-start', handleReset)
		return () => {
			off('load-start', resetOptimize)
			off('load-start', handleReset)
		}
	}, [off, on, resetOptimize, setOptimizationRuntime])

	useEffect(() => {
		if (
			!file?.model ||
			isPending ||
			typeof latestSceneStats?.currentSceneBytes === 'number' ||
			typeof clientSceneBytes === 'number' ||
			isSceneSizeCalculationInFlightRef.current
		) {
			return
		}

		isSceneSizeCalculationInFlightRef.current = true

		void calculateSceneBytes()
			.then((computedSceneBytes) => {
				if (typeof computedSceneBytes !== 'number') {
					return
				}

				setOptimizationRuntime((prev) => ({
					...prev,
					clientSceneBytes: computedSceneBytes
				}))
			})
			.catch((error) => {
				console.error('Failed to calculate scene size:', error)
			})
			.finally(() => {
				isSceneSizeCalculationInFlightRef.current = false
			})
	}, [
		file?.model,
		isPending,
		latestSceneStats,
		clientSceneBytes,
		calculateSceneBytes,
		setOptimizationRuntime
	])

	const sizeInfo: SizeInfo = {
		initialSceneBytes:
			clientSceneBytes ?? latestSceneStats?.initialSceneBytes ?? null,
		currentSceneBytes:
			optimizedSceneBytes ??
			clientSceneBytes ??
			latestSceneStats?.currentSceneBytes ??
			null,
		initialTextureBytes:
			clientTextureBytes ?? report?.stats.textures.before ?? null,
		currentTextureBytes:
			optimizedTextureBytes ??
			report?.stats.textures.after ??
			clientTextureBytes ??
			null
	}
	const initialSceneBytes = sizeInfo.initialSceneBytes ?? null
	const currentSceneBytes = sizeInfo.currentSceneBytes ?? initialSceneBytes
	const hasSceneSizeImprovement =
		typeof initialSceneBytes === 'number' &&
		typeof currentSceneBytes === 'number'
			? currentSceneBytes < initialSceneBytes
			: false
	const hasReportImprovement =
		(report?.appliedOptimizations?.length ?? 0) > 0 ||
		info.improvement.verticesCount > 0 ||
		info.improvement.primitivesCount > 0 ||
		info.improvement.meshesCount > 0 ||
		info.improvement.texturesCount > 0
	const hasImproved = hasReportImprovement || hasSceneSizeImprovement

	return {
		info,
		report,
		isPending,
		hasImproved,
		sizeInfo,
		handleOptimizeClick
	}
}
