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
import eventSystem from './event-system'
import { initialState } from './state'

import type { ServerOptions, ServerSceneData } from '@vctrl/core'

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
 * Configuration options for loading a scene from the server.
 */
export interface SceneLoadOptions {
	/** The unique identifier of the scene to load */
	sceneId: string
	/** Server configuration (endpoint, auth, headers) */
	serverOptions?: ServerOptions
	/** Whether to automatically apply scene settings (default: true) */
	applySettings?: boolean
}

/**
 * Configuration options for loading an already-resolved scene payload.
 */
export interface SceneDataLoadOptions {
	/** Resolved server scene payload */
	sceneData: ServerSceneData
	/** Whether to automatically apply scene settings (default: true) */
	applySettings?: boolean
}

/**
 * Result of a scene load operation based on server data.
 * Combines the loaded model with its settings.
 */
export interface SceneLoadResult extends ServerSceneData {
	/** The loaded model file */
	file: ModelFile
	/** Scene ID that was loaded */
}

/**
 * State interface for model loading data.
 * Contains the current loaded file, loading status, and progress information.
 */
export interface LoadData {
	/** The currently loaded model file, or null if no model is loaded */
	file: ModelFile | null
	/** Whether a file is currently being loaded */
	isFileLoading: boolean
	/** Loading progress percentage (0-100) */
	progress: number
	/** List of supported model file types */
	supportedFileTypes: ModelFileTypes[]
}

/**
 * Action types for the model loading reducer.
 * Defines all possible state mutations for model loading operations.
 */
export type Action =
	| { type: 'set-file'; payload: ModelFile }
	| { type: 'set-file-loading'; payload: boolean }
	| { type: 'set-progress'; payload: number }
	| { type: 'reset-state' }

/**
 * Available event types emitted by the model loading system.
 * Used for subscribing to various stages of the loading process.
 */
export type EventTypes =
	| 'multiple-models' // Emitted when multiple model files are detected in upload
	| 'not-loaded-files' // Emitted when no supported files are found
	| 'load-start' // Emitted when loading begins
	| 'load-progress' // Emitted during loading progress updates
	| 'load-complete' // Emitted when loading successfully completes
	| 'load-reset' // Emitted when the state is reset
	| 'load-error' // Emitted when an error occurs during loading
	| 'server-load-start' // Emitted when server-based scene loading begins
	| 'server-load-complete' // Emitted when server-based scene loading completes
	| 'server-load-error' // Emitted when server-based scene loading fails

/**
 * Maps event types to their corresponding data payloads.
 * Ensures type safety when handling events.
 */
export type EventData = {
	/** Array of model files when multiple are detected */
	'multiple-models': File[]
	/** Array of unsupported files */
	'not-loaded-files': File[]
	/** No data for load start event */
	'load-start': null
	/** Progress value (0-100) */
	'load-progress': number
	/** The loaded model file data */
	'load-complete': LoadData['file']
	/** No data for reset event */
	'load-reset': null
	/** Error object when loading fails */
	'load-error': Error | unknown
	/** Scene ID being loaded from server */
	'server-load-start': string
	/** Complete scene load result */
	'server-load-complete': SceneLoadResult
	/** Error during server scene loading */
	'server-load-error': Error | unknown
}

/**
 * Type-safe event handler function.
 * @template T - The event type being handled
 */
export type EventHandler<T extends EventTypes> = (data?: EventData[T]) => void

/**
 * Return type for the useLoadModel hook.
 * Conditionally includes optimizer integration based on whether an optimizer was provided.
 *
 * @template HasOptimizer - Boolean indicating if optimizer integration is included
 */
export type UseLoadModelReturn<HasOptimizer extends boolean> =
	typeof initialState & {
		/**
		 * Subscribe to model loading events.
		 * @param event - The event type to listen for
		 * @param handler - Callback function to handle the event
		 */
		on: typeof eventSystem.on
		/**
		 * Unsubscribe from model loading events.
		 * @param event - The event type to stop listening for
		 * @param handler - The callback function to remove
		 */
		off: typeof eventSystem.off
		/**
		 * Load 3D model files from File objects or directory handles.
		 * Supports GLTF, GLB, and USDZ formats with associated assets.
		 */
		load: (filesOrDirectories: InputFileOrDirectory) => Promise<void>
		/**
		 * Load a scene from the server by scene ID.
		 * Fetches both the model and scene settings, applies them automatically.
		 *
		 * @param options - Scene loading configuration
		 * @returns Promise resolving to the loaded scene data
		 *
		 * @example
		 * ```tsx
		 * const model = useLoadModel()
		 *
		 * // Load a scene from the server
		 * const scene = await model.loadFromServer({
		 *   sceneId: 'abc-123',
		 *   serverOptions: {
		 *     endpoint: '/api/load-scene',
		 *     apiKey: 'optional-auth-token'
		 *   }
		 * })
		 * ```
		 */
		loadFromServer: (options: SceneLoadOptions) => Promise<SceneLoadResult>
		/**
		 * Reset the model loading state and clear any loaded models.
		 */
		reset: () => void
		/**
		 * Optimizer integration object.
		 * - When optimizer is provided: Contains full optimization methods and state
		 * - When no optimizer: null
		 */
		optimizer: HasOptimizer extends true
			? OptimizerIntegrationReturn<true>
			: null
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
				 *
				 * @example
				 * // Apply multiple optimizations in sequence
				 * await optimizer.applyOptimization(optimizer.dedupOptimization)
				 * await optimizer.applyOptimization(optimizer.quantizeOptimization, { bits: 12 })
				 */
				applyOptimization: <TOptions>(
					optimizationFunction?:
						| ((options?: TOptions) => Promise<void>)
						| undefined,
					options?: TOptions
				) => Promise<void>
			}
		: null
