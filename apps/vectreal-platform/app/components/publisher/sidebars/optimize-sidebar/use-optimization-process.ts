import { useExportModel } from '@vctrl/hooks/use-export-model'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'

import {
	createBillingLimitErrorFromResponse,
	isBillingLimitError,
	toUpgradeModalPayload
} from '../../../../lib/domain/billing/client/billing-limit-error'
import {
	optimizationAtom,
	optimizationRuntimeAtom
} from '../../../../lib/stores/scene-optimization-store'
import {
	buildUpgradeModalState,
	upgradeModalAtom
} from '../../../../lib/stores/upgrade-modal-store'

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

type OptimizationRunIntent = 'check' | 'consume'

async function requestOptimizationRunQuota(
	intent: OptimizationRunIntent
): Promise<{ outcome?: string; currentValue?: number; limit?: null | number }> {
	const response = await fetch('/api/billing/optimization-runs', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ intent })
	})

	let payload: {
		error?: string
		success?: boolean
		quota?: unknown
		data?: {
			outcome?: string
			currentValue?: number
			limit?: null | number
		}
	} | null = null
	try {
		payload = (await response.json()) as {
			error?: string
			success?: boolean
			quota?: unknown
			data?: {
				outcome?: string
				currentValue?: number
				limit?: null | number
			}
		}
	} catch {
		payload = null
	}

	if (!response.ok || payload?.success === false) {
		const billingLimitError = createBillingLimitErrorFromResponse(
			response.status,
			payload,
			intent === 'check'
				? 'Unable to validate optimization quota before starting.'
				: 'Unable to record optimization run usage.'
		)
		if (billingLimitError) {
			throw billingLimitError
		}

		const fallbackMessage =
			intent === 'check'
				? 'Unable to validate optimization quota before starting.'
				: 'Unable to record optimization run usage.'
		throw new Error(payload?.error || fallbackMessage)
	}

	return {
		outcome: payload?.data?.outcome,
		currentValue: payload?.data?.currentValue,
		limit: payload?.data?.limit
	}
}

/**
 * Custom hook that encapsulates the optimization logic and state management
 */
export const useOptimizationProcess = () => {
	const { optimizer, on, off, file } = useModelContext(true)
	const { handleDocumentGltfExport } = useExportModel()
	const {
		reset: resetOptimize,
		isReady,
		isPreparing,
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
	const setUpgradeModal = useSetAtom(upgradeModalAtom)
	const {
		isPending,
		isSceneSizeLoading,
		optimizedSceneBytes,
		clientSceneBytes,
		optimizedTextureBytes,
		clientTextureBytes,
		latestSceneStats
	} = optimizationRuntime
	const isSceneSizeCalculationInFlightRef = useRef(false)

	const calculateSceneBytes = useCallback(async () => {
		if (!isReady) {
			return null
		}

		const exportedGlb = await optimizer.getModel()
		if (!exportedGlb) return null
		return exportedGlb.byteLength
	}, [isReady, optimizer])

	const calculateOptimizedTextureBytes = useCallback(async () => {
		if (!isReady) {
			return null
		}

		const gltfDocument = optimizer._getDocument()
		if (!gltfDocument) {
			return null
		}

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
	}, [isReady, optimizer, handleDocumentGltfExport, file])

	// Handle optimization process
	const handleOptimizeClick = useCallback(async () => {
		if (isPending || isPreparing || !isReady) return

		setOptimizationRuntime((prev) => ({
			...prev,
			isPending: true
		}))

		try {
			const optimizationOptions = Object.values(plannedOptimizations).filter(
				(option): option is OptimizationOption => !!option && option.enabled
			)
			let shouldConsumeOptimizationRun = false

			if (optimizationOptions.length > 0) {
				const checkResult = await requestOptimizationRunQuota('check')
				if (
					checkResult.outcome === 'soft_limit_warning' &&
					typeof checkResult.currentValue === 'number' &&
					typeof checkResult.limit === 'number'
				) {
					toast.warning(
						`Optimization usage is high (${checkResult.currentValue}/${checkResult.limit}). Consider upgrading to avoid interruptions.`
					)
				}
			}

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
						isSceneSizeLoading: false,
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

			for (let i = 0; i < optimizationOptions.length; i++) {
				const option = optimizationOptions[i]

				try {
					// Apply single optimization based on option type
					if (option.name === 'simplification') {
						await simplifyOptimization(option)
						shouldConsumeOptimizationRun = true
					} else if (option.name === 'texture') {
						await texturesOptimization(option)
						shouldConsumeOptimizationRun = true
					} else if (option.name === 'quantize') {
						await quantizeOptimization()
						shouldConsumeOptimizationRun = true
					} else if (option.name === 'dedup') {
						await dedupOptimization()
						shouldConsumeOptimizationRun = true
					} else if (option.name === 'normals') {
						await normalsOptimization()
						shouldConsumeOptimizationRun = true
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

					if (
						option.name === 'texture' &&
						error instanceof Error &&
						error.message.includes('failed for ') &&
						!error.message.includes('failed for all textures')
					) {
						shouldConsumeOptimizationRun = true
					}
				}
			}

			// Apply all optimizations
			await applyOptimization()

			if (optimizationOptions.length > 0 && shouldConsumeOptimizationRun) {
				await requestOptimizationRunQuota('consume')
			}

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
			if (isBillingLimitError(error)) {
				const modalPayload = toUpgradeModalPayload(error)
				setUpgradeModal(
					buildUpgradeModalState({
						...modalPayload,
						actionAttempted: 'optimization_run'
					})
				)
				toast.error(error.message)
				return
			}

			toast.error(
				error instanceof Error
					? error.message
					: 'Optimization failed. Please retry.'
			)
		} finally {
			setOptimizationRuntime((prev) => ({
				...prev,
				isPending: false
			}))
		}
	}, [
		isPending,
		isPreparing,
		isReady,
		clientSceneBytes,
		clientTextureBytes,
		latestSceneStats,
		calculateSceneBytes,
		calculateOptimizedTextureBytes,
		setOptimizationRuntime,
		setUpgradeModal,
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
		if (typeof clientSceneBytes === 'number') {
			if (!isSceneSizeLoading) {
				return
			}

			setOptimizationRuntime((prev) => ({
				...prev,
				isSceneSizeLoading: false
			}))
			return
		}

		if (typeof file?.sourcePackageBytes !== 'number') {
			return
		}

		setOptimizationRuntime((prev) => ({
			...prev,
			isSceneSizeLoading: false,
			clientSceneBytes: file.sourcePackageBytes ?? null
		}))
	}, [
		clientSceneBytes,
		file?.sourcePackageBytes,
		isSceneSizeLoading,
		setOptimizationRuntime
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
				isSceneSizeLoading: true,
				optimizedSceneBytes: null,
				clientSceneBytes: null,
				optimizedTextureBytes: null,
				clientTextureBytes: null,
				latestSceneStats: null
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
			typeof clientSceneBytes === 'number' ||
			isSceneSizeCalculationInFlightRef.current
		) {
			return
		}

		isSceneSizeCalculationInFlightRef.current = true
		setOptimizationRuntime((prev) => ({
			...prev,
			isSceneSizeLoading: true
		}))

		void calculateSceneBytes()
			.then((computedSceneBytes) => {
				if (typeof computedSceneBytes !== 'number') {
					setOptimizationRuntime((prev) => ({
						...prev,
						isSceneSizeLoading: false
					}))
					return
				}

				setOptimizationRuntime((prev) => ({
					...prev,
					isSceneSizeLoading: false,
					clientSceneBytes: computedSceneBytes
				}))
			})
			.catch((error) => {
				console.error('Failed to calculate scene size:', error)
				setOptimizationRuntime((prev) => ({
					...prev,
					isSceneSizeLoading: false
				}))
			})
			.finally(() => {
				isSceneSizeCalculationInFlightRef.current = false
			})
	}, [
		file?.model,
		isPending,
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
		isOptimizerPreparing: isPreparing,
		isOptimizerReady: isReady,
		hasImproved,
		sizeInfo,
		handleOptimizeClick
	}
}
