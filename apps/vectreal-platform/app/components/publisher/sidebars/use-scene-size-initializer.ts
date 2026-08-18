import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtom } from 'jotai/react'
import { useEffect, useRef } from 'react'

import { optimizationRuntimeAtom } from '../../../lib/stores/scene-optimization-store'

/**
 * Fills in the scene's byte size so the bottom bar is populated before the tool
 * sidebar is ever opened.
 *
 * The loader reports the size of what it loaded, and a saved scene's manifest
 * carries it too, so this only has to cover the one case neither can: a model
 * whose source bytes are unknown, which has to be measured by exporting it.
 */
export function useSceneSizeInitializer() {
	const { file, optimizer } = useModelContext(true)
	const [{ clientSceneBytes }, setOptimizationRuntime] = useAtom(
		optimizationRuntimeAtom
	)

	const measurementInFlightRef = useRef(false)

	// Sizes the loader already knows.
	useEffect(() => {
		if (!file) return

		setOptimizationRuntime((previous) => ({
			...previous,
			isSceneSizeLoading:
				previous.clientSceneBytes === null &&
				typeof file.sourcePackageBytes !== 'number',
			clientSceneBytes:
				previous.clientSceneBytes ?? file.sourcePackageBytes ?? null,
			clientTextureBytes:
				previous.clientTextureBytes ?? file.sourceTextureBytes ?? null
		}))
	}, [file, setOptimizationRuntime])

	// The fallback: measure by exporting what the optimizer holds.
	useEffect(() => {
		if (
			!file?.model ||
			typeof clientSceneBytes === 'number' ||
			!optimizer.isReady ||
			measurementInFlightRef.current
		) {
			return
		}

		measurementInFlightRef.current = true

		void optimizer
			.getModel()
			.then((exportedGlb) => {
				setOptimizationRuntime((previous) => ({
					...previous,
					isSceneSizeLoading: false,
					clientSceneBytes: exportedGlb?.byteLength ?? previous.clientSceneBytes
				}))
			})
			.catch((error) => {
				console.error('Failed to calculate scene size:', error)
				setOptimizationRuntime((previous) => ({
					...previous,
					isSceneSizeLoading: false
				}))
			})
			.finally(() => {
				measurementInFlightRef.current = false
			})
	}, [clientSceneBytes, file?.model, optimizer, setOptimizationRuntime])
}
