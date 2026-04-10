import { useExportModel } from '@vctrl/hooks/use-export-model'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtom, useAtomValue, useSetAtom } from 'jotai/react'
import { useCallback, useEffect, useState } from 'react'
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
	const timeoutId = setTimeout(
		() => controller.abort(),
		QUOTA_CHECK_TIMEOUT_MS
	)

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
		simplifyOptimization,
		texturesOptimization,
		quantizeOptimization,
		dedupOptimization,
		normalsOptimization,
		applyOptimization,
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

	// Handle optimization process
	const handleOptimizeClick = useCallback(async () => {
		if (isPending || isPreparing || !isReady) return

		let didApplyOptimization = false

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

			for (let i = 0; i < optimizationOptions.length; i++) {
				const option = optimizationOptions[i]

				try {
					if (option.name === 'simplification') {
						await withTimeout(
							simplifyOptimization(option),
							OPTIMIZATION_STEP_TIMEOUT_MS,
							'Simplification'
						)
						shouldConsumeOptimizationRun = true
					} else if (option.name === 'texture') {
						await withTimeout(
							texturesOptimization(option),
							OPTIMIZATION_STEP_TIMEOUT_MS,
							'Texture optimization'
						)
						shouldConsumeOptimizationRun = true
					} else if (option.name === 'quantize') {
						await withTimeout(
							quantizeOptimization(),
							OPTIMIZATION_STEP_TIMEOUT_MS,
							'Quantization'
						)
						shouldConsumeOptimizationRun = true
					} else if (option.name === 'dedup') {
						await withTimeout(
							dedupOptimization(),
							OPTIMIZATION_STEP_TIMEOUT_MS,
							'Deduplication'
						)
						shouldConsumeOptimizationRun = true
					} else if (option.name === 'normals') {
						await withTimeout(
							normalsOptimization(),
							OPTIMIZATION_STEP_TIMEOUT_MS,
							'Normals optimization'
						)
						shouldConsumeOptimizationRun = true
					} else {
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

			// Sync the optimized model back to the Three.js viewer
			if (shouldConsumeOptimizationRun) {
				try {
					await withTimeout(
						applyOptimization(),
						MODEL_SYNC_TIMEOUT_MS,
						'Model sync'
					)
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
				return
			}

			toast.error(
				error instanceof Error && error.message.includes('Unauthorized')
					? 'Sign in to sync optimization quotas across browsers.'
					: error instanceof Error
						? error.message
						: 'Optimization failed. Please retry.'
			)
		} finally {
			setOptimizationRuntime((prev) => ({
				...prev,
				isPending: false
			}))
		}

		if (didApplyOptimization) {
			void refreshOptimizedSizeInfo()
		}
	}, [
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
		simplifyOptimization,
		texturesOptimization,
		quantizeOptimization,
		dedupOptimization,
		normalsOptimization,
		applyOptimization,
		calculateSceneBytes,
		file?.sourcePackageBytes,
		file?.sourceTextureBytes,
		report?.stats.textures.before
	])

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
		guestQuota,
		handleOptimizeClick
	}
}
