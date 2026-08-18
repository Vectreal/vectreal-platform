import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtom } from 'jotai/react'
import { useEffect, useRef } from 'react'

import { optimizationRuntimeAtom } from '../../../lib/stores/scene-optimization-store'

import type { Object3D } from 'three'

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

	// `useOptimizerIntegration` rebuilds its object every render, so the effect
	// below keys off the model it would measure instead. Measuring is also
	// attempted once per model: a null result must not re-trigger through the
	// state it writes.
	const optimizerRef = useRef(optimizer)
	optimizerRef.current = optimizer
	const measuredModelRef = useRef<Object3D | null>(null)

	// Sizes the loader already knows. Keyed on the size as well as the model, so
	// an upload's own reset landing after this has run refills it rather than
	// leaving the card blank until the next save.
	useEffect(() => {
		if (!file || typeof clientSceneBytes === 'number') return

		// A size that went back to null is a size to measure again.
		measuredModelRef.current = null

		setOptimizationRuntime((previous) => ({
			...previous,
			isSceneSizeLoading: typeof file.sourcePackageBytes !== 'number',
			clientSceneBytes: file.sourcePackageBytes ?? null,
			clientTextureBytes:
				previous.clientTextureBytes ?? file.sourceTextureBytes ?? null
		}))
	}, [clientSceneBytes, file, setOptimizationRuntime])

	// The fallback: measure by exporting what the optimizer holds.
	useEffect(() => {
		const model = file?.model
		if (
			!model ||
			typeof clientSceneBytes === 'number' ||
			!optimizer.isReady ||
			measuredModelRef.current === model
		) {
			return
		}

		measuredModelRef.current = model

		void optimizerRef.current
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
	}, [clientSceneBytes, file?.model, optimizer.isReady, setOptimizationRuntime])
}
