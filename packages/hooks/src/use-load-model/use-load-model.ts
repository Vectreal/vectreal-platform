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

import { PERSISTED_BAKE_FILENAME, toSerializedAssetBytes } from '@vctrl/core'
import { ModelFileTypes, ModelLoader } from '@vctrl/core/model-loader'
import { useCallback, useMemo, useReducer, useRef } from 'react'

import { normalizeServerLoadError } from './error-helpers'
import eventSystem from './event-system'
import { loadBinaryModel, loadGltfModel } from './file-loaders'
import { useOptimizerIntegration } from './optimizer-integration'
import reducer, { initialState } from './state'
import {
	InputFileOrDirectory,
	ModelFile,
	SceneDataLoadOptions,
	SceneLoadOptions,
	SceneLoadResult,
	UseLoadModelReturn
} from './types'
import {
	calculateReferencedBytesFromFiles,
	calculateReferencedBytesFromServerScene,
	readDirectory,
	resolveServerSceneDataContract,
	reconstructGltfFiles
} from './utils'
import { fetchManifestAssetData } from './utils/fetch-manifest-assets'

import type { useOptimizeModel } from '../use-optimize-model'
import type {
	ApiEnvelope,
	OperationProgress,
	ServerScenePayload
} from '@vctrl/core'

async function fetchManifestPayload(
	endpoint: string,
	headers: HeadersInit
): Promise<ServerScenePayload | null> {
	try {
		const res = await fetch(endpoint, {
			method: 'GET',
			headers: { Accept: 'application/json', ...headers }
		})
		if (!res.ok) return null

		const envelope = (await res.json()) as ApiEnvelope<ServerScenePayload>
		const candidate = (envelope.data ?? envelope) as ServerScenePayload

		if (!candidate || typeof candidate !== 'object') return null
		if (!candidate.gltfJson) return null
		if (!candidate.assetRefs && !candidate.assetData) return null

		return candidate
	} catch {
		return null
	}
}

async function fetchLegacyScenePayload(
	endpoint: string,
	headers: HeadersInit,
	sceneId: string
): Promise<ServerScenePayload> {
	const formData = new FormData()
	formData.append('action', 'get-scene-settings')
	formData.append('sceneId', sceneId)

	const res = await fetch(endpoint, { method: 'POST', headers, body: formData })

	if (!res.ok) {
		throw new Error(`Server responded with ${res.status} ${res.statusText}`)
	}

	const envelope = (await res.json()) as ApiEnvelope<ServerScenePayload>
	return (envelope.data ?? envelope) as ServerScenePayload
}

/**
 * Custom hook to load and manage 3D models with optional optimization integration.
 *
 * Supports GLTF, GLB, and USDZ formats via file upload or server-side scene loading.
 * When an optimizer is provided, each load path initialises the optimizer so texture
 * names and URIs are preserved for subsequent compression or simplification passes.
 *
 * **Type Safety:**
 * - With optimizer: `optimizer` property is fully typed with optimization methods
 * - Without optimizer: `optimizer` property is typed as `null`
 *
 * @template T - The type of the optimizer parameter (inferred automatically)
 * @param optimizer - Optional optimizer hook returned from useOptimizeModel
 * @returns Model loading state and methods, with conditionally typed optimizer property
 */
function useLoadModel<
	T extends ReturnType<typeof useOptimizeModel> | undefined
>(optimizer?: T): UseLoadModelReturn<T extends undefined ? false : true> {
	const uploadCompleteRef = useRef(false)
	const loadedFileRef = useRef<ModelFile | null>(null)
	const [state, dispatch] = useReducer(reducer, initialState)

	const modelLoader = useMemo(() => {
		const loader = new ModelLoader()
		loader.onProgress((progress: OperationProgress) => {
			dispatch({ type: 'set-progress', payload: progress.progress })
			if (progress.progress === 100) return
			eventSystem.emit('load-progress', progress.progress)
		})
		return loader
	}, [])

	const updateProgress = useCallback((progress: number) => {
		dispatch({ type: 'set-progress', payload: progress })
		eventSystem.emit('load-progress', progress)
	}, [])

	const reset = useCallback(() => {
		dispatch({ type: 'reset-state' })
		eventSystem.emit('load-reset')
	}, [])

	const getFileOfType = useCallback(
		(files: File[], fileType: ModelFileTypes) =>
			files.find((file) => file.name.endsWith('.' + fileType)),
		[]
	)

	const processFiles = useCallback(
		async (files: File[]) => {
			if (files.length === 0) return

			const gltfFile = getFileOfType(files, ModelFileTypes.gltf)
			const glbFile = getFileOfType(files, ModelFileTypes.glb)
			const usdzFile = getFileOfType(files, ModelFileTypes.usdz)

			const supportedFiles = [gltfFile, glbFile, usdzFile].filter(
				Boolean
			) as File[]

			if (supportedFiles.length > 1) {
				eventSystem.emit('multiple-models', supportedFiles)
				return
			}

			const otherFiles = files.filter(
				(file) => file !== gltfFile && file !== glbFile && file !== usdzFile
			)

			const markUploadComplete = () => {
				uploadCompleteRef.current = true
				if (loadedFileRef.current) {
					eventSystem.emit('load-complete', loadedFileRef.current)
					uploadCompleteRef.current = false
				}
			}

			if (gltfFile) {
				const loaded = await loadGltfModel(
					gltfFile,
					otherFiles,
					modelLoader,
					optimizer,
					dispatch,
					calculateReferencedBytesFromFiles
				)
				if (loaded) loadedFileRef.current = loaded
				markUploadComplete()
			} else if (glbFile) {
				const loaded = await loadBinaryModel(
					glbFile,
					ModelFileTypes.glb,
					modelLoader,
					optimizer,
					dispatch
				)
				if (loaded) loadedFileRef.current = loaded
				markUploadComplete()
			} else if (usdzFile) {
				const loaded = await loadBinaryModel(
					usdzFile,
					ModelFileTypes.usdz,
					modelLoader,
					optimizer,
					dispatch
				)
				if (loaded) loadedFileRef.current = loaded
				markUploadComplete()
			} else {
				eventSystem.emit('not-loaded-files', files)
				dispatch({ type: 'set-file-loading', payload: false })
			}
		},
		[getFileOfType, modelLoader, optimizer]
	)

	const load = useCallback(
		async (filesOrDirectories: InputFileOrDirectory): Promise<void> => {
			const allFiles: File[] = []

			eventSystem.emit('load-start')
			dispatch({ type: 'reset-state' })
			dispatch({ type: 'set-file-loading', payload: true })

			updateProgress(0)
			uploadCompleteRef.current = false

			for (const item of filesOrDirectories) {
				if (item instanceof File) {
					allFiles.push(item)
				} else if ('kind' in item && item.kind === 'directory') {
					const directoryFiles = await readDirectory(item)
					allFiles.push(...directoryFiles)
				}
			}

			await processFiles(allFiles)
		},
		[processFiles, updateProgress]
	)

	const loadFromData = useCallback(
		async (options: SceneDataLoadOptions): Promise<SceneLoadResult> => {
			const { sceneData, sceneId } = options

			updateProgress(40)

			if (options.parseMode === 'direct' && sceneData.gltfJson) {
				const assets = new Map<string, Uint8Array>()
				for (const entry of Object.values(sceneData.assetData ?? {})) {
					if (entry.fileName === PERSISTED_BAKE_FILENAME) continue
					assets.set(entry.fileName, toSerializedAssetBytes(entry))
				}

				const { sourcePackageBytes, textureBytes } =
					calculateReferencedBytesFromServerScene(sceneData)

				updateProgress(60)

				const result = await modelLoader.parseGLTFJsonToThreeJS(
					sceneData.gltfJson,
					assets
				)

				const loadedFile: ModelFile = {
					model: result.scene,
					type: ModelFileTypes.gltf,
					name: sceneData.meta?.name || 'scene',
					sourcePackageBytes,
					sourceTextureBytes: textureBytes
				}

				dispatch({ type: 'set-file', payload: loadedFile })
				dispatch({ type: 'set-file-loading', payload: false })
				loadedFileRef.current = loadedFile
				updateProgress(100)

				return { file: loadedFile, sceneId, ...sceneData }
			}

			const files = reconstructGltfFiles(sceneData)
			const { sourcePackageBytes, textureBytes } =
				calculateReferencedBytesFromServerScene(sceneData)

			updateProgress(60)

			const gltfFile = files[0] as File
			const otherFiles = files.slice(1) as File[]

			const result = await modelLoader.loadGLTFWithAssetsToThreeJS(
				gltfFile,
				otherFiles
			)

			const loadedFile: ModelFile = {
				model: result.scene,
				type: ModelFileTypes.gltf,
				name: gltfFile.name,
				sourcePackageBytes,
				sourceTextureBytes: textureBytes
			}

			dispatch({ type: 'set-file', payload: loadedFile })
			dispatch({ type: 'set-file-loading', payload: false })
			loadedFileRef.current = loadedFile

			if (optimizer) {
				await optimizer.loadFromServerSceneData(sceneData)
			}

			updateProgress(100)

			return {
				file: loadedFile,
				sceneId,
				...sceneData
			}
		},
		[modelLoader, optimizer, updateProgress]
	)

	const loadFromServer = useCallback(
		async (options: SceneLoadOptions): Promise<SceneLoadResult> => {
			const { sceneId, serverOptions, parseMode } = options

			try {
				eventSystem.emit('server-load-start', sceneId)
				dispatch({ type: 'reset-state' })
				dispatch({ type: 'set-file-loading', payload: true })
				updateProgress(0)

				const endpoint = serverOptions?.endpoint ?? `/api/scenes/${sceneId}`
				const headers: HeadersInit = serverOptions?.apiKey
					? {
							Authorization: `Bearer ${serverOptions.apiKey}`,
							...serverOptions.headers
						}
					: { ...serverOptions?.headers }

				let scenePayload = await fetchManifestPayload(endpoint, headers)

				if (scenePayload?.assetRefs && !scenePayload.assetData) {
					updateProgress(10)
					const assetData = await fetchManifestAssetData(
						scenePayload.assetRefs,
						{
							headers,
							onProgress: (fraction) =>
								updateProgress(10 + Math.round(fraction * 30))
						}
					)
					scenePayload = { ...scenePayload, assetData }
				}

				if (!scenePayload) {
					scenePayload = await fetchLegacyScenePayload(
						endpoint,
						headers,
						sceneId
					)
				}

				const sceneData = resolveServerSceneDataContract(scenePayload)

				const sceneLoadResult = await loadFromData({ sceneId, sceneData, parseMode })

				eventSystem.emit('server-load-complete', sceneLoadResult)

				return sceneLoadResult
			} catch (error) {
				console.error('Server scene loading failed:', error)
				dispatch({ type: 'set-file-loading', payload: false })
				const structuredError = normalizeServerLoadError(error, sceneId)
				eventSystem.emit('server-load-error', structuredError)
				throw structuredError
			}
		},
		[loadFromData, updateProgress]
	)

	const optimizerIntegration = useOptimizerIntegration(
		optimizer,
		dispatch,
		state.file,
		modelLoader
	)

	return {
		...state,
		on: eventSystem.on,
		off: eventSystem.off,
		load,
		loadFromData,
		loadFromServer,
		reset,
		optimizer: optimizerIntegration
	} as UseLoadModelReturn<T extends undefined ? false : true>
}

export default useLoadModel
