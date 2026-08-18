import { PERSISTED_BAKE_FILENAME, toSerializedAssetBytes } from '@vctrl/core'
import { ModelFileTypes } from '@vctrl/core/model-loader'

import {
	createStructuredLoadError,
	normalizeServerLoadError
} from './error-helpers'
import { ingestIntoOptimizer } from './optimizer-ingest'
import { LoadedModel, ModelSource } from './types'
import {
	calculateReferencedBytesFromServerScene,
	reconstructGltfFiles,
	resolveServerSceneDataContract
} from './utils'
import { fetchManifestAssetData } from './utils/fetch-manifest-assets'

import type { LoadContext } from './load-context'
import type { ApiEnvelope, ServerScenePayload } from '@vctrl/core'

type SceneDataSource = Extract<ModelSource, { kind: 'scene-data' }>
type ServerSource = Extract<ModelSource, { kind: 'server' }>

/**
 * Loads a scene payload the caller already holds: a route aggregate, an IndexedDB
 * draft, or the response of a server fetch.
 *
 * The payload may reference its binary assets instead of carrying them, which is
 * what a route manifest does. Resolving those references here is what lets a
 * server-rendered aggregate and a client fetch take the same path.
 *
 * `parseMode: 'direct'` parses the glTF JSON with the assets held in memory and
 * skips the optimizer, which is the read-only fast path used by the embed and
 * the dashboard. The default path reconstructs real files so the optimizer can
 * ingest the same bytes the viewer renders.
 */
export const loadModelFromSceneData = async (
	{ sceneId, sceneData: payload, parseMode }: SceneDataSource,
	{ modelLoader, optimizer, publish, onProgress }: LoadContext
): Promise<LoadedModel> => {
	if (!payload.gltfJson) {
		throw createStructuredLoadError({
			code: 'missing_assets',
			message: 'This scene has no model data to load.',
			recoverable: false,
			source: 'server-load',
			context: { sceneId }
		})
	}

	const sceneData = resolveServerSceneDataContract(
		payload.assetRefs && !payload.assetData
			? {
					...payload,
					assetData: await fetchManifestAssetData(payload.assetRefs, {
						onProgress: (fraction) => onProgress(Math.round(fraction * 40))
					})
				}
			: payload
	)

	onProgress(40)

	const { sourcePackageBytes, textureBytes } =
		calculateReferencedBytesFromServerScene(sceneData)

	if (parseMode === 'direct' && sceneData.gltfJson) {
		const assets = new Map<string, Uint8Array>()
		for (const entry of Object.values(sceneData.assetData ?? {})) {
			if (entry.fileName === PERSISTED_BAKE_FILENAME) continue
			assets.set(entry.fileName, toSerializedAssetBytes(entry))
		}

		onProgress(60)

		const result = await modelLoader.parseGLTFJsonToThreeJS(
			sceneData.gltfJson,
			assets
		)

		const loaded: LoadedModel = {
			file: {
				model: result.scene,
				type: ModelFileTypes.gltf,
				name: sceneData.meta?.name || 'scene',
				sourcePackageBytes,
				sourceTextureBytes: textureBytes
			},
			sceneId,
			sceneData
		}

		publish(loaded)
		return loaded
	}

	const files = reconstructGltfFiles(sceneData)
	onProgress(60)

	const gltfFile = files[0] as File
	const otherFiles = files.slice(1) as File[]

	const result = await modelLoader.loadGLTFWithAssetsToThreeJS(
		gltfFile,
		otherFiles
	)

	const loaded: LoadedModel = {
		file: {
			model: result.scene,
			type: ModelFileTypes.gltf,
			name: gltfFile.name,
			sourcePackageBytes,
			sourceTextureBytes: textureBytes
		},
		sceneId,
		sceneData
	}

	publish(loaded)

	if (optimizer) {
		await ingestIntoOptimizer(() => optimizer.loadFromServerSceneData(sceneData))
	}

	return loaded
}

/**
 * Fetches a scene by id and loads it. Prefers the manifest endpoint and falls
 * back to the legacy form-post contract for scenes the manifest cannot serve.
 */
export const loadModelFromServer = async (
	source: ServerSource,
	ctx: LoadContext
): Promise<LoadedModel> => {
	const { sceneId, serverOptions, parseMode } = source
	const { onProgress } = ctx

	try {
		onProgress(0)

		const endpoint = serverOptions?.endpoint ?? `/api/scenes/${sceneId}`
		const headers: HeadersInit = serverOptions?.apiKey
			? {
					Authorization: `Bearer ${serverOptions.apiKey}`,
					...serverOptions.headers
				}
			: { ...serverOptions?.headers }

		const scenePayload =
			(await fetchManifestPayload(endpoint, headers)) ??
			(await fetchLegacyScenePayload(endpoint, headers, sceneId))

		return await loadModelFromSceneData(
			{ kind: 'scene-data', sceneId, sceneData: scenePayload, parseMode },
			ctx
		)
	} catch (error) {
		throw normalizeServerLoadError(error, sceneId)
	}
}

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
