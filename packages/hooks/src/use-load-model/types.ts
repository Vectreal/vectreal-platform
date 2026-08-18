/* vectreal-core | vctrl/hooks
Copyright (C) 2024 Moritz Becker

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>. */

import { ModelFileTypes } from '@vctrl/core/model-loader'
import { Object3D } from 'three'

import { useOptimizeModel } from '../use-optimize-model'

import type {
	ServerOptions,
	ServerSceneData,
	ServerScenePayload
} from '@vctrl/core'

export type {
	ExtendedGLTFDocument,
	SceneAssetDataEntry,
	SerializedSceneAssetDataMap as SceneAssetDataMap,
	ServerSceneData,
	ServerScenePayload
} from '@vctrl/core'

/**
 * Type representing the input for file/folder uploads.
 * Can be either File objects or FileSystemDirectoryHandle for folder drag-and-drop.
 */
export type InputFileOrDirectory = (File | FileSystemDirectoryHandle)[]

/**
 * Represents a loaded 3D model file with its metadata.
 */
export interface ModelFile {
	/** The Three.js Object3D scene containing the loaded model */
	model: Object3D
	/** The file type/format of the model (GLTF, GLB, USDZ) */
	type: ModelFileTypes
	/** The original filename of the model */
	name: string
	/** Byte size of referenced source package (gltf + referenced buffers/images) */
	sourcePackageBytes?: number
	/** Byte size of referenced texture assets from source package */
	sourceTextureBytes?: number
}

/**
 * Where a model comes from. Every load in the platform is one of these three,
 * and they all go through the single `load(source)` entry point.
 */
export type ModelSource =
	/** Files or folders picked by the user (GLTF + assets, GLB, or USDZ). */
	| { kind: 'files'; files: InputFileOrDirectory }
	/**
	 * A scene payload the caller already has in memory (route aggregate, IDB
	 * draft). Binary assets may be referenced rather than inlined; the loader
	 * fetches them.
	 */
	| {
			kind: 'scene-data'
			sceneId?: string
			sceneData: ServerScenePayload
			/** 'direct' parses glTF JSON straight with GLTFLoader (view-only fast path). */
			parseMode?: 'document' | 'direct'
	  }
	/** A scene fetched from the API by id. */
	| {
			kind: 'server'
			sceneId: string
			serverOptions?: ServerOptions
			parseMode?: 'document' | 'direct'
	  }

export type ModelSourceKind = ModelSource['kind']

/**
 * The loader's state, as one value.
 *
 * `status === 'ready'` and `file !== null` are the same fact by construction, so
 * a consumer cannot end up rendering "no model" and "finished loading" at once.
 * `file` and `error` are present on every variant so callers can read them
 * without narrowing; only their types change.
 */
interface ModelStateShape {
	progress: number
	/** The scene payload the model came from, for sources that have one. */
	sceneData?: ServerSceneData
	sceneId?: string
}

export type ModelState =
	| (ModelStateShape & {
			status: 'empty'
			file: null
			error: null
			source: null
	  })
	| (ModelStateShape & {
			status: 'loading'
			file: null
			error: null
			source: ModelSourceKind
	  })
	| (ModelStateShape & {
			status: 'ready'
			file: ModelFile
			error: null
			source: ModelSourceKind
	  })
	| (ModelStateShape & {
			status: 'error'
			file: null
			error: StructuredLoadError
			source: ModelSourceKind
	  })

/**
 * A model parsed into Three.js, plus whatever scene payload produced it.
 * Internal hand-off between the per-source loaders and the hook.
 */
export interface LoadedModel {
	file: ModelFile
	sceneId?: string
	sceneData?: ServerSceneData
}

/**
 * Result of a scene load operation based on server data.
 * Combines the loaded model with its settings.
 */
export interface SceneLoadResult extends ServerSceneData {
	/** The loaded model file */
	file: ModelFile
	/** Scene ID that was loaded */
	sceneId?: string
}

export type ViewerLoadErrorCode =
	| 'unsupported_format'
	| 'multiple_models'
	| 'binary_load_failed'
	| 'gltf_load_failed'
	| 'missing_assets'
	| 'server_load_failed'
	| 'not_found'
	| 'quota_exceeded'
	| 'unknown'

export interface StructuredLoadError {
	code: ViewerLoadErrorCode
	message: string
	recoverable: boolean
	source: 'local-upload' | 'server-load'
	cause?: unknown
	context?: Record<string, unknown>
}

/**
 * Return type for the useLoadModel hook.
 * Conditionally includes optimizer integration based on whether an optimizer was provided.
 *
 * @template HasOptimizer - Boolean indicating if optimizer integration is included
 */
export type UseLoadModelReturn<HasOptimizer extends boolean> = ModelState & {
	/** List of supported model file types */
	supportedFileTypes: ModelFileTypes[]
	/**
	 * Load a model from any source.
	 *
	 * Never rejects: a failure is the returned `error` state, which is also the
	 * state every consumer already renders from. The terminal state is returned
	 * for callers that need to branch on the outcome right away.
	 *
	 * A newer `load` supersedes an older one, so an in-flight load can never
	 * overwrite the state of the load that replaced it.
	 *
	 * @example
	 * ```tsx
	 * const model = useLoadModel()
	 *
	 * await model.load({ kind: 'files', files })
	 * await model.load({ kind: 'server', sceneId: 'abc-123' })
	 * ```
	 */
	load: (source: ModelSource) => Promise<ModelState>
	/**
	 * Reset the model loading state and clear any loaded models.
	 */
	reset: () => void
	/**
	 * Optimizer integration object.
	 * - When optimizer is provided: Contains full optimization methods and state
	 * - When no optimizer: null
	 */
	optimizer: HasOptimizer extends true ? OptimizerIntegrationReturn<true> : null
}

/**
 * Return type of the useOptimizeModel hook.
 * Provides access to all optimization methods and state.
 */
export type OptimizerReturnType = ReturnType<typeof useOptimizeModel>

/**
 * Conditional return type for optimizer integration.
 * Extends the optimizer with additional integration methods when present.
 *
 * @template HasOptimizer - Boolean indicating if optimizer is integrated
 */
export type OptimizerIntegrationReturn<HasOptimizer extends boolean = false> =
	HasOptimizer extends true
		? OptimizerReturnType & {
				/**
				 * Whether the optimizer is still preparing the currently visible model.
				 */
				isPreparing: boolean

				/**
				 * Applies an optimization and updates the loaded model with the result.
				 *
				 * This method:
				 * 1. Runs the specified optimization function
				 * 2. Retrieves the optimized model
				 * 3. Loads it back into the scene
				 * 4. Updates the model state
				 *
				 * @template TOptions - Type of options for the optimization function
				 * @param optimizationFunction - The optimization to apply (e.g., simplifyOptimization)
				 * @param options - Configuration options for the optimization
				 * @returns Promise that resolves when optimization is complete and model is updated
				 *
				 * @example
				 * // Apply simplification optimization
				 * await optimizer.applyOptimization(
				 *   optimizer.simplifyOptimization,
				 *   { ratio: 0.5 }
				 * )
				 */
				applyOptimization: <TOptions>(
					optimizationFunction?:
						| ((options?: TOptions) => Promise<void>)
						| undefined,
					options?: TOptions
				) => Promise<void>
			}
		: null
