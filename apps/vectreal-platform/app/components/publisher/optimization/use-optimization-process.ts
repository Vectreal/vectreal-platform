import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtom, useAtomValue, useSetAtom } from 'jotai/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import {
	withTimeout,
	requestOptimizationRunQuota,
	toGuestQuotaState,
	DEFAULT_GUEST_QUOTA_LIMIT,
	runGeometryOptimizationsInWorker,
	OPTIMIZATION_STEP_TIMEOUT_MS,
	MODEL_SYNC_TIMEOUT_MS,
	useSceneSizeCalculator
} from './utils'
import {
	isBillingLimitError,
	toUpgradeModalPayload
} from '../../../lib/domain/billing/client/billing-limit-error'
import { resolveSceneMetrics } from '../../../lib/domain/scene'
import { loadOriginalSceneModel } from '../../../lib/persistence/pending-scene-idb'
import {
	optimizationAtom,
	optimizationRuntimeAtom
} from '../../../lib/stores/scene-optimization-store'
import {
	buildUpgradeModalState,
	upgradeModalAtom
} from '../../../lib/stores/upgrade-modal-store'

import type {
	GuestQuotaState,
	OptimizationQuotaResult
} from './utils/optimization-quota'
import type { WorkerOptimizationOptions } from '../../../workers/optimization.worker.types'
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
	isSceneSizeComputing?: boolean
	isInitialMetricsHydrating?: boolean
}

type OptimizationOption =
	| SimplificationOptimization
	| TextureOptimization
	| QuantizeOptimization
	| DedupOptimization
	| NormalsOptimization

const STEP_LABELS: Record<string, string> = {
	simplification: 'Mesh simplification',
	texture: 'Texture optimization',
	quantize: 'Vertex quantization',
	dedup: 'Duplicate removal',
	normals: 'Normal refinement'
}
const SYNC_STEP = 'Syncing to viewer'

/**
 * Custom hook that encapsulates the optimization logic and state management
 */
export const useOptimizationProcess = ({
	isAuthenticated
}: {
	isAuthenticated: boolean
}) => {
	const { optimizer, file } = useModelContext(true)
	const {
		isReady,
		isPreparing,
		texturesOptimization,
		applyOptimization,
		reset,
		loadFromServerSceneData,
		loadFromGlbBuffer,
		getModel,
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
		optimizedSceneBytes,
		clientSceneBytes,
		optimizedTextureBytes,
		clientTextureBytes,
		latestSceneStats
	} = optimizationRuntime

	const [guestQuota, setGuestQuota] = useState<GuestQuotaState | null>(
		isAuthenticated
			? null
			: {
					currentValue: 0,
					limit: DEFAULT_GUEST_QUOTA_LIMIT,
					remaining: DEFAULT_GUEST_QUOTA_LIMIT
				}
	)
	const [optimizingStep, setOptimizingStep] = useState<{
		current: string | null
		completed: string[]
		allSteps: string[]
	}>({ current: null, completed: [], allSteps: [] })

	const { calculateSceneBytes, refreshOptimizedSizeInfo } =
		useSceneSizeCalculator(
			optimizer,
			file ?? null,
			isReady,
			report?.stats.textures.after,
			setOptimizationRuntime
		)

	// Shared optimization body.
	// Pass fromOriginal=true (default) to reload from the IDB original snapshot first
	// — non-destructive preset switching. Pass fromOriginal=false to apply on top of
	// the current optimizer document state (fine-tuning / stacking).
	const runOptimization = useCallback(
		async (fromOriginal: boolean): Promise<boolean> => {
			if (isPending || isPreparing || !isReady) return false

			setOptimizationRuntime((prev) => ({ ...prev, isPending: true }))

			let didApplyOptimization = false

			try {
				if (fromOriginal) {
					const original = await loadOriginalSceneModel()
					if (original) {
						reset()
						await loadFromServerSceneData(original.sceneData)
					} else {
						console.warn(
							'[optimization] No original scene in IDB; optimizing from current document state.'
						)
					}
				}

				const optimizationOptions = Object.values(plannedOptimizations).filter(
					(option): option is OptimizationOption => !!option && option.enabled
				)
				let shouldConsumeOptimizationRun = false

				const stepNames = optimizationOptions.map(
					(o) => STEP_LABELS[o.name] ?? o.name
				)
				setOptimizingStep({
					current: null,
					completed: [],
					allSteps: [...stepNames, SYNC_STEP]
				})

				if (optimizationOptions.length > 0) {
					const checkResult = await requestOptimizationRunQuota('check')
					if (checkResult.isGuest) {
						setGuestQuota(toGuestQuotaState(checkResult))
						if (typeof checkResult.remaining === 'number') {
							toast.message(
								`Guest optimizations left today: ${checkResult.remaining}/${typeof checkResult.limit === 'number' ? checkResult.limit : DEFAULT_GUEST_QUOTA_LIMIT}`
							)
						}
					}
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
								: await withTimeout(
										calculateSceneBytes(),
										MODEL_SYNC_TIMEOUT_MS,
										'Baseline scene size calculation'
									)
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

				// --- Geometry phase (Web Worker) ---
				const geometryOptions = optimizationOptions.filter(
					(o): o is Exclude<OptimizationOption, TextureOptimization> =>
						o.name !== 'texture'
				)
				const textureOption = optimizationOptions.find(
					(o): o is TextureOptimization => o.name === 'texture'
				)

				if (geometryOptions.length > 0) {
					const workerOptions: WorkerOptimizationOptions = {}
					for (const option of geometryOptions) {
						if (option.name === 'simplification') {
							workerOptions.simplify = {
								enabled: true,
								ratio: option.ratio,
								error: option.error
							}
						} else if (option.name === 'quantize') {
							workerOptions.quantize = {
								enabled: true,
								quantizePosition: option.quantizePosition,
								quantizeNormal: option.quantizeNormal,
								quantizeColor: option.quantizeColor,
								quantizeTexcoord: option.quantizeTexcoord
							}
						} else if (option.name === 'dedup') {
							workerOptions.dedup = {
								enabled: true,
								textures: option.textures,
								materials: option.materials,
								meshes: option.meshes,
								accessors: option.accessors
							}
						} else if (option.name === 'normals') {
							workerOptions.normals = {
								enabled: true,
								overwrite: option.overwrite
							}
						}
					}

					const currentBuffer = await withTimeout(
						getModel(),
						MODEL_SYNC_TIMEOUT_MS,
						'Model export for worker'
					)
					if (!currentBuffer) {
						toast.warning(
							'Could not export the model for geometry optimization. Try reloading the scene.'
						)
					} else {
						let lastWorkerStep: string | null = null

						const optimizedBuffer = await withTimeout(
							runGeometryOptimizationsInWorker(
								currentBuffer,
								workerOptions,
								(step, progress) => {
									if (step !== lastWorkerStep) {
										lastWorkerStep = step
										setOptimizingStep((prev) => ({ ...prev, current: step }))
									} else if (progress === 100) {
										// Step posted its own completion — tick it immediately
										setOptimizingStep((prev) => ({
											...prev,
											completed: [...prev.completed, step]
										}))
										lastWorkerStep = null
									}
								}
							),
							OPTIMIZATION_STEP_TIMEOUT_MS * geometryOptions.length,
							'Geometry worker'
						)

						if (lastWorkerStep) {
							setOptimizingStep((prev) => ({
								...prev,
								completed: [...prev.completed, lastWorkerStep!]
							}))
						}

						await withTimeout(
							loadFromGlbBuffer(optimizedBuffer),
							MODEL_SYNC_TIMEOUT_MS,
							'Worker result sync'
						)
						shouldConsumeOptimizationRun = true
					}
				}

				// --- Texture phase (browser-native OffscreenCanvas encoder) ---
				if (textureOption) {
					const stepLabel = STEP_LABELS['texture']
					setOptimizingStep((prev) => ({ ...prev, current: stepLabel }))
					try {
						await withTimeout(
							texturesOptimization(textureOption),
							OPTIMIZATION_STEP_TIMEOUT_MS,
							'Texture optimization'
						)
						shouldConsumeOptimizationRun = true
						setOptimizingStep((prev) => ({
							...prev,
							completed: [...prev.completed, stepLabel]
						}))
					} catch (error) {
						console.error('Error processing texture:', error)
						if (
							error instanceof Error &&
							error.message.includes('failed for ') &&
							!error.message.includes('failed for all textures')
						) {
							shouldConsumeOptimizationRun = true
							setOptimizingStep((prev) => ({
								...prev,
								completed: [...prev.completed, stepLabel]
							}))
						}
					}
				}

				// Sync the optimized model back to the Three.js viewer
				if (shouldConsumeOptimizationRun) {
					setOptimizingStep((prev) => ({ ...prev, current: SYNC_STEP }))
					try {
						await withTimeout(
							applyOptimization(),
							MODEL_SYNC_TIMEOUT_MS,
							'Model sync'
						)
						setOptimizingStep((prev) => ({
							...prev,
							completed: [...prev.completed, SYNC_STEP]
						}))
					} catch (syncError) {
						console.warn('Model sync after optimization failed:', syncError)
					}
				}

				didApplyOptimization = shouldConsumeOptimizationRun

				if (optimizationOptions.length > 0 && shouldConsumeOptimizationRun) {
					try {
						const consumeResult = await requestOptimizationRunQuota('consume')
						if (consumeResult.isGuest) {
							setGuestQuota(toGuestQuotaState(consumeResult))
						}
					} catch (error) {
						console.warn('Failed to record optimization run usage:', error)
					}
				}
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
					return false
				}

				toast.error(
					error instanceof Error && error.message.includes('Unauthorized')
						? 'Sign in to sync optimization quotas across browsers.'
						: error instanceof Error
							? error.message
							: 'Optimization failed. Please retry.'
				)
				return false
			} finally {
				setOptimizationRuntime((prev) => ({ ...prev, isPending: false }))
				setOptimizingStep({ current: null, completed: [], allSteps: [] })
			}

			if (didApplyOptimization) {
				void refreshOptimizedSizeInfo()
			}

			return didApplyOptimization
		},
		[
			isPending,
			isPreparing,
			isReady,
			clientSceneBytes,
			clientTextureBytes,
			latestSceneStats,
			refreshOptimizedSizeInfo,
			setOptimizationRuntime,
			setUpgradeModal,
			plannedOptimizations,
			texturesOptimization,
			applyOptimization,
			reset,
			loadFromServerSceneData,
			loadFromGlbBuffer,
			getModel,
			calculateSceneBytes,
			file?.sourcePackageBytes,
			file?.sourceTextureBytes,
			report?.stats.textures.before
		]
	)

	const handleOptimizeClick = useCallback(
		() => runOptimization(true),
		[runOptimization]
	)

	const handleStackOptimizeClick = useCallback(
		() => runOptimization(false),
		[runOptimization]
	)

	useEffect(() => {
		if (isAuthenticated) {
			setGuestQuota(null)
			return
		}

		let cancelled = false
		void requestOptimizationRunQuota('check')
			.then((result: OptimizationQuotaResult) => {
				if (cancelled || !result.isGuest) return
				setGuestQuota(toGuestQuotaState(result))
			})
			.catch((error: unknown) => {
				console.warn('Failed to fetch guest optimization quota:', error)
			})

		return () => {
			cancelled = true
		}
	}, [isAuthenticated])

	const resolvedMetrics = useMemo(
		() =>
			resolveSceneMetrics({
				stats: latestSceneStats,
				report,
				info,
				runtime: {
					initialSceneBytes: clientSceneBytes,
					currentSceneBytes: optimizedSceneBytes,
					initialTextureBytes: clientTextureBytes,
					currentTextureBytes: optimizedTextureBytes,
					isSceneSizeComputing: optimizationRuntime.isSceneSizeLoading
				}
			}),
		[
			latestSceneStats,
			report,
			info,
			clientSceneBytes,
			optimizedSceneBytes,
			clientTextureBytes,
			optimizedTextureBytes,
			optimizationRuntime.isSceneSizeLoading
		]
	)

	const sizeInfo: SizeInfo = {
		initialSceneBytes: resolvedMetrics.sceneBytes.initial,
		currentSceneBytes: resolvedMetrics.sceneBytes.current,
		initialTextureBytes: resolvedMetrics.textureBytes.initial,
		currentTextureBytes: resolvedMetrics.textureBytes.current,
		isSceneSizeComputing: resolvedMetrics.isSceneSizeComputing,
		isInitialMetricsHydrating: resolvedMetrics.isInitialMetricsHydrating
	}

	const hasImproved = resolvedMetrics.hasImproved
	const hasCompletedOptimizationPass =
		typeof optimizationRuntime.optimizedSceneBytes === 'number'

	return {
		info,
		report,
		resolvedMetrics,
		isPending,
		isOptimizerPreparing: isPreparing,
		isOptimizerReady: isReady,
		hasImproved,
		hasCompletedOptimizationPass,
		sizeInfo,
		guestQuota,
		optimizingStep,
		handleOptimizeClick,
		handleStackOptimizeClick
	}
}
