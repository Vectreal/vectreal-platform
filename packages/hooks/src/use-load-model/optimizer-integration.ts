import { ModelFileTypes, ModelLoader } from '@vctrl/core/model-loader'
import { TextureCompressionError } from '@vctrl/core/model-optimizer'
import { useCallback } from 'react'

import { ModelFile, OptimizerIntegrationReturn } from './types'

import type { useOptimizeModel } from '../use-optimize-model'

/**
 * Integrates the optimizer into the model loading process.
 *
 * Provides the `applyOptimization` method that:
 * 1. Runs an optional optimization function
 * 2. Exports the optimized model as GLB
 * 3. Reloads it into Three.js
 * 4. Swaps it into the loaded model, leaving the load state itself untouched
 *
 * Returns `null` when no optimizer instance is provided.
 */
export function useOptimizerIntegration(
	instance: ReturnType<typeof useOptimizeModel> | undefined,
	replaceModel: (file: ModelFile, forLoadId: number) => void,
	file: ModelFile | null,
	/** The load whose model a pass started from, so its result lands only there. */
	loadId: number | null,
	modelLoader: ModelLoader
): OptimizerIntegrationReturn<boolean> {
	const applyOptimization = useCallback(
		async <TOptions>(
			optimizationFunction?:
				((options?: TOptions) => Promise<void>) | undefined,
			options?: TOptions
		) => {
			if (!instance) {
				throw new Error('No optimizer to apply the optimization with.')
			}
			// Captured with this callback, so a load that starts while the pass
			// runs cannot receive its result.
			if (loadId === null) {
				throw new Error('No model was ready when this optimizer was read.')
			}

			// A partial texture pass committed what it compressed, so the viewer
			// shows that before the caller hears what did not compress.
			let partialFailure: TextureCompressionError | null = null
			try {
				if (optimizationFunction) await optimizationFunction(options)
			} catch (error) {
				if (!(error instanceof TextureCompressionError && error.isPartial)) {
					throw error
				}
				partialFailure = error
			}

			const optimizedModel = await instance.getModel()
			if (!optimizedModel) {
				throw new Error('No optimized model could be exported.')
			}

			const optimizedBlobPart =
				optimizedModel instanceof Uint8Array
					? optimizedModel.slice()
					: new Uint8Array(optimizedModel as ArrayBufferLike).slice()

			const optimizedFile = new File(
				[optimizedBlobPart],
				file?.name || 'optimized_model.glb',
				{ type: 'model/gltf-binary' }
			)

			const result = await modelLoader
				.loadToThreeJS(optimizedFile)
				.catch((error: unknown) => {
					throw new Error('The optimized model could not be shown.', {
						cause: error
					})
				})

			// Dropped, not refused, when a newer load holds the state: the pass
			// did its work, and that load's model is the one to show.
			replaceModel(
				{
					model: result.scene,
					// Re-read from the optimized model rather than carrying the
					// previous clips over: optimization can legitimately change
					// what survives, and a stale clip would be bound against a
					// scene graph that no longer matches it.
					animations: result.animations,
					type: ModelFileTypes.glb,
					name: optimizedFile.name
				},
				loadId
			)

			if (partialFailure) throw partialFailure
		},
		[instance, modelLoader, file, loadId, replaceModel]
	)

	if (!instance) return null as OptimizerIntegrationReturn<boolean>

	return {
		...instance,
		isPreparing: Boolean(file?.model) && !instance.isReady,
		applyOptimization
	} as OptimizerIntegrationReturn<boolean>
}
