import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtom } from 'jotai/react'
import { useCallback, useEffect, useRef } from 'react'

import { optimizationRuntimeAtom } from '../../../../lib/stores/scene-optimization-store'

/**
 * Runs scene-size calculation effects unconditionally so the bottom bar can
 * show the loaded scene's size before the tool sidebar is ever opened.
 *
 * Call this hook from a component that is always mounted while the publisher
 * scene view is active (e.g. OverlayControls).
 */
export function useSceneSizeInitializer() {
	const { optimizer, file, on, off } = useModelContext(true)
	const [optimizationRuntime, setOptimizationRuntime] = useAtom(
		optimizationRuntimeAtom
	)
	const {
		isPending,
		isSceneSizeLoading,
		clientSceneBytes,
		clientTextureBytes
	} = optimizationRuntime

	const isSceneSizeCalculationInFlightRef = useRef(false)

	const { isReady } = optimizer

	const calculateSceneBytes = useCallback(async () => {
		if (!isReady) {
			return null
		}

		const exportedGlb = await optimizer.getModel()
		if (!exportedGlb) return null
		return exportedGlb.byteLength
	}, [isReady, optimizer])

	// If the file already carries a known byte-length, use it directly.
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

	// Same shortcut for texture bytes.
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

	// Reset optimization/runtime state for real source-load flows.
	// `load-start` is emitted by useLoadModel.load() before user/server model
	// loading, and is not emitted by applyOptimization() internal model swaps.
	useEffect(() => {
		const handleLoadStart = () => {
			isSceneSizeCalculationInFlightRef.current = false
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

		on('load-start', handleLoadStart)
		return () => {
			off('load-start', handleLoadStart)
		}
	}, [off, on, setOptimizationRuntime])

	useEffect(() => {
		const handleLoadComplete = () => {
			setOptimizationRuntime((prev) =>
				prev.isPending ? { ...prev, isPending: false } : prev
			)
		}

		on('load-complete', handleLoadComplete)
		return () => {
			off('load-complete', handleLoadComplete)
		}
	}, [off, on, setOptimizationRuntime])

	// Fall back to calculating the size via the optimizer export when no
	// pre-computed byte count is available.
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
}
