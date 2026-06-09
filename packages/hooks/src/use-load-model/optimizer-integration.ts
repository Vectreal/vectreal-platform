import { ModelFileTypes, ModelLoader } from '@vctrl/core/model-loader'
import { useCallback } from 'react'
import React from 'react'

import { Action, ModelFile, OptimizerIntegrationReturn } from './types'

import type { useOptimizeModel } from '../use-optimize-model'

/**
 * Integrates the optimizer into the model loading process.
 *
 * Provides the `applyOptimization` method that:
 * 1. Runs an optional optimization function
 * 2. Exports the optimized model as GLB
 * 3. Reloads it into Three.js
 * 4. Updates the model state
 *
 * Returns `null` when no optimizer instance is provided.
 */
export function useOptimizerIntegration(
	instance: ReturnType<typeof useOptimizeModel> | undefined,
	dispatch: React.Dispatch<Action>,
	file: ModelFile | null,
	modelLoader: ModelLoader
): OptimizerIntegrationReturn<boolean> {
	const applyOptimization = useCallback(
		async <TOptions>(
			optimizationFunction?:
				| ((options?: TOptions) => Promise<void>)
				| undefined,
			options?: TOptions
		) => {
			if (!instance) {
				console.warn('Optimizer is not available')
				return
			}

			try {
				if (optimizationFunction) await optimizationFunction(options)

				const optimizedModel = await instance.getModel()
				if (!optimizedModel) {
					console.warn('No optimized model available after optimization')
					return
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

				const result = await modelLoader.loadToThreeJS(optimizedFile)

				dispatch({
					type: 'set-file',
					payload: {
						model: result.scene,
						type: ModelFileTypes.glb,
						name: optimizedFile.name
					}
				})
			} catch (error) {
				console.error('Optimization failed:', error)
			}
		},
		[instance, modelLoader, file, dispatch]
	)

	if (!instance) return null as OptimizerIntegrationReturn<boolean>

	const isReady = instance.isReady
	const isPreparing = Boolean(file?.model) && !isReady

	return {
		...instance,
		isReady,
		isPreparing,
		applyOptimization,
		reset: instance?.reset,
		error: instance?.error,
		loading: instance?.loading
	} as OptimizerIntegrationReturn<boolean>
}
