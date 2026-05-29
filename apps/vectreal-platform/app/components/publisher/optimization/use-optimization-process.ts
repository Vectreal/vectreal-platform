import { useExportModel } from '@vctrl/hooks/use-export-model'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtom, useAtomValue, useSetAtom } from 'jotai/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import type {
	WorkerInputMessage,
	WorkerOptimizationOptions,
	WorkerOutputMessage,
} from '../../../workers/optimization.worker.types'

import {
	createBillingLimitErrorFromResponse,
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

type OptimizationRunIntent = 'check' | 'consume'

type OptimizationQuotaResult = {
	outcome?: string
	currentValue?: number
	limit?: null | number
	remaining?: null | number
	isGuest?: boolean
	windowExpiresAt?: number
}

type GuestQuotaState = {
	currentValue: number
	limit: number
	remaining: number
}

const DEFAULT_GUEST_QUOTA_LIMIT = 5

function toGuestQuotaState(result: OptimizationQuotaResult): GuestQuotaState {
	const limit =
		typeof result.limit === 'number' ? result.limit : DEFAULT_GUEST_QUOTA_LIMIT
	const currentValue =
		typeof result.currentValue === 'number' ? result.currentValue : 0
	const remaining =
		typeof result.remaining === 'number'
			? result.remaining
			: Math.max(0, limit - currentValue)

	return {
		currentValue,
		limit,
		remaining
	}
}

/** Race a promise against a timeout. Rejects with a descriptive error on timeout. */
function withTimeout<T>(
	promise: Promise<T>,
	ms: number,
	label: string
): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error(`${label} timed out after ${ms}ms`)),
			ms
		)
		promise.then(
			(val) => {
				clearTimeout(timer)
				resolve(val)
			},
			(err) => {
				clearTimeout(timer)
				reject(err)
			}
		)
	})
}

const QUOTA_CHECK_TIMEOUT_MS = 10_000
const OPTIMIZATION_STEP_TIMEOUT_MS = 90_000
const MODEL_SYNC_TIMEOUT_MS = 60_000

async function requestOptimizationRunQuota(
	intent: OptimizationRunIntent
): Promise<OptimizationQuotaResult> {
	const fallbackMessage =
		intent === 'check'
			? 'Unable to validate optimization quota before starting.'
			: 'Unable to record optimization run usage.'

	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), QUOTA_CHECK_TIMEOUT_MS)

	let response: Response
	try {
		response = await fetch('/api/billing/optimization-runs', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ intent }),
			signal: controller.signal
		})
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			throw new Error(
				`Quota request timed out after ${QUOTA_CHECK_TIMEOUT_MS}ms.`
			)
		}

		throw new Error(
			error instanceof Error && error.message
				? `${fallbackMessage} ${error.message}`
				: fallbackMessage
		)
	} finally {
		clearTimeout(timeoutId)
	}

	let payload: {
		error?: string
		success?: boolean
		quota?: unknown
		data?: {
			outcome?: string
			currentValue?: number
			limit?: null | number
			remaining?: null | number
			isGuest?: boolean
			windowExpiresAt?: number
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
				remaining?: null | number
				isGuest?: boolean
				windowExpiresAt?: number
			}
		}
	} catch {
		payload = null
	}

	if (!response.ok || payload?.success === false) {
		const billingLimitError = createBillingLimitErrorFromResponse(
			response.status,
			payload,
			fallbackMessage
		)
		if (billingLimitError) {
			throw billingLimitError
		}

		throw new Error(payload?.error || fallbackMessage)
	}

	return {
		outcome: payload?.data?.outcome,
		currentValue: payload?.data?.currentValue,
		limit: payload?.data?.limit,
		remaining: payload?.data?.remaining,
		isGuest: payload?.data?.isGuest,
		windowExpiresAt: payload?.data?.windowExpiresAt
	}
}

/**
 * Runs geometry-level optimizations (simplify/dedup/quantize/normals) in a Web
 * Worker so the main thread stays responsive. Texture compression is excluded —
 * it routes to the Supabase Edge Function separately.
 *
 * @param inputBuffer  Current model as GLB bytes
 * @param options      Which non-texture steps to run
 * @param onProgress   Called with step label + 0–100 progress each update
 * @returns            Optimized GLB bytes
 */
async function runGeometryOptimizationsInWorker(
	inputBuffer: Uint8Array,
	options: WorkerOptimizationOptions,
	onProgress: (step: string, progress: number) => void
): Promise<Uint8Array> {
	return new Promise<Uint8Array>((resolve, reject) => {
		const worker = new Worker(
			new URL('../../../workers/optimization.worker.ts', import.meta.url),
			{ type: 'module' }
		)

		worker.onmessage = (event: MessageEvent<WorkerOutputMessage>) => {
			const msg = event.data
			switch (msg.type) {
				case 'progress':
					onProgress(msg.step, msg.progress)
					break
				case 'done':
					worker.terminate()
					resolve(new Uint8Array(msg.buffer))
					break
				case 'error':
					worker.terminate()
					reject(new Error(msg.message))
					break
			}
		}

		worker.onerror = (err) => {
			worker.terminate()
			reject(new Error(err.message ?? 'Optimization worker crashed'))
		}

		// Transfer the buffer to the worker for zero-copy handoff
		const transferBuffer = inputBuffer.buffer.slice(
			inputBuffer.byteOffset,
			inputBuffer.byteOffset + inputBuffer.byteLength
		) as ArrayBuffer
		const msg: WorkerInputMessage = {
			type: 'optimize',
			buffer: transferBuffer,
			options,
		}
		worker.postMessage(msg, [transferBuffer])
	})
}

/**
 * Custom hook that encapsulates the optimization logic and state management
 */
export const useOptimizationProcess = ({
	isAuthenticated
}: {
	isAuthenticated: boolean
}) => {
	const { optimizer, file } = useModelContext(true)
	const { handleDocumentGltfExport } = useExportModel()
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
					: typeof report?.stats.textures.after === 'number'
						? report.stats.textures.after
						: null
		}))
	}, [
		calculateOptimizedTextureBytes,
		calculateSceneBytes,
		report?.stats.textures.after,
		setOptimizationRuntime
	])

	// Shared optimization body. Pass fromOriginal=true (default) to reload from the
	// IDB original snapshot first - non-destructive preset switching per the article.
	// Pass fromOriginal=false to apply on top of the current optimizer document state.
	const runOptimization = useCallback(
		async (fromOriginal: boolean): Promise<boolean> => {
			if (isPending || isPreparing || !isReady) return false

			// Lock the UI immediately so the drawer cannot be closed and the button
			// shows "Optimizing..." during the IDB reload phase.
			setOptimizationRuntime((prev) => ({
				...prev,
				isPending: true
			}))

			let didApplyOptimization = false

			const STEP_LABELS: Record<string, string> = {
				simplification: 'Mesh simplification',
				texture: 'Texture optimization',
				quantize: 'Vertex quantization',
				dedup: 'Duplicate removal',
				normals: 'Normal refinement'
			}
			const SYNC_STEP = 'Syncing to viewer'

			try {
				if (fromOriginal) {
					// Non-destructive: reload from the original unoptimized snapshot so each
					// preset starts from the original file rather than the previously optimized
					// state. Runs inside try so finally always clears isPending on failure.
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

				// --- Geometry phase (Web Worker, non-blocking) ---
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
					if (currentBuffer) {
						let lastWorkerStep: string | null = null

						const optimizedBuffer = await withTimeout(
							runGeometryOptimizationsInWorker(
								currentBuffer,
								workerOptions,
								(step, _progress) => {
									if (step !== lastWorkerStep) {
										if (lastWorkerStep) {
											setOptimizingStep((prev) => ({
												...prev,
												completed: [...prev.completed, lastWorkerStep!]
											}))
										}
										lastWorkerStep = step
										setOptimizingStep((prev) => ({ ...prev, current: step }))
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

				// --- Texture phase (Supabase Edge Function via server) ---
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
				setOptimizationRuntime((prev) => ({
					...prev,
					isPending: false
				}))
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

	// Non-destructive: re-applies the current preset from the original uploaded file.
	const handleOptimizeClick = useCallback(
		() => runOptimization(true),
		[runOptimization]
	)

	// Stacking: applies on top of the current optimizer state (fine-tuning).
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
			.then((result) => {
				if (cancelled || !result.isGuest) {
					return
				}

				setGuestQuota(toGuestQuotaState(result))
			})
			.catch((error) => {
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
