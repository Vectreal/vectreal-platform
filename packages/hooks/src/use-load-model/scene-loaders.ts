import { PERSISTED_BAKE_FILENAME, toSerializedAssetBytes } from '@vctrl/core'
import { ModelFileTypes } from '@vctrl/core/model-loader'

import {
	createStructuredLoadError,
	isStructuredLoadError,
	normalizeServerLoadError
} from './error-helpers'
import { ingestIntoOptimizer } from './optimizer-ingest'
import { LoadedModel, ModelSource } from './types'
import {
	calculateReferencedBytesFromServerScene,
	reconstructGltfFiles,
	resolvePublishedSceneDataContract,
	resolveServerSceneDataContract
} from './utils'
import { fetchManifestAssetData } from './utils/fetch-manifest-assets'

import type { LoadContext } from './load-context'
import type {
	ApiEnvelope,
	SceneAssetRef,
	ServerScenePayload
} from '@vctrl/core'

type SceneDataSource = Extract<ModelSource, { kind: 'scene-data' }>
type ServerSource = Extract<ModelSource, { kind: 'server' }>

/**
 * Where a scene is read from, resolved once so the manifest request and the
 * asset requests that follow it cannot end up authenticating differently.
 */
const resolveSceneEndpoint = ({ sceneId, serverOptions }: ServerSource) => ({
	endpoint: serverOptions?.endpoint ?? `/api/scenes/${sceneId}`,
	headers: serverOptions?.apiKey
		? {
				Authorization: `Bearer ${serverOptions.apiKey}`,
				...serverOptions.headers
			}
		: { ...serverOptions?.headers }
})

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
/**
 * Key the published GLB borrows inside the asset map while it is fetched.
 *
 * Riding along with the real asset refs is what buys byte-weighted progress
 * across the model and the bake together, one abort controller, and one set of
 * auth headers. It is removed again before the map becomes `assetData`, so it
 * never reaches the viewer.
 */
const PUBLISHED_MODEL_KEY = '__vctrl_published_model__'

/**
 * Loads a scene from its published, optimized GLB.
 *
 * This is the external embed path. A GLB is self-contained, so there is no
 * glTF document and no separate buffers or textures - only assets that live
 * outside the model, which today means the persisted shadow bake.
 */
const loadPublishedSceneModel = async (
	sceneId: string | undefined,
	payload: ServerScenePayload,
	publishedModel: SceneAssetRef,
	{ modelLoader, publish, onProgress }: LoadContext,
	assetHeaders?: HeadersInit
): Promise<LoadedModel> => {
	const fetched = await fetchManifestAssetData(
		{ ...(payload.assetRefs ?? {}), [PUBLISHED_MODEL_KEY]: publishedModel },
		{
			headers: assetHeaders,
			onProgress: (fraction) => onProgress(Math.round(fraction * 60))
		}
	)

	const modelEntry = fetched[PUBLISHED_MODEL_KEY]
	delete fetched[PUBLISHED_MODEL_KEY]

	if (!modelEntry) {
		throw createStructuredLoadError({
			code: 'missing_assets',
			message: 'This scene has no published model to load.',
			recoverable: false,
			source: 'server-load',
			context: { sceneId }
		})
	}

	const sceneData = resolvePublishedSceneDataContract({
		...payload,
		assetData: fetched
	})

	onProgress(70)

	const modelBytes = toSerializedAssetBytes(modelEntry)
	const blobBytes = new Uint8Array(modelBytes.byteLength)
	blobBytes.set(modelBytes)
	const blob = new Blob([blobBytes], { type: publishedModel.mimeType })

	// The same entry point a dropped `.glb` takes, so the Draco decoder is
	// attached exactly as it is everywhere else.
	const result = await modelLoader.loadToThreeJS(
		new File([blob], publishedModel.fileName, { type: publishedModel.mimeType })
	)

	const loaded: LoadedModel = {
		file: {
			model: result.scene,
			animations: result.animations,
			type: ModelFileTypes.glb,
			name: sceneData.meta?.name || publishedModel.fileName,
			// Texture bytes are unknowable from outside a GLB; leaving it undefined
			// is honest, whereas reporting the package size twice is not.
			sourcePackageBytes: publishedModel.byteSize ?? undefined
		},
		sceneId,
		sceneData
	}

	publish(loaded)
	return loaded
}

export const loadModelFromSceneData = async (
	source: SceneDataSource,
	ctx: LoadContext,
	assetHeaders?: HeadersInit
): Promise<LoadedModel> => {
	const { sceneId, sceneData: payload, parseMode } = source
	const { modelLoader, optimizer, publish, onProgress } = ctx

	if (payload.publishedModel) {
		return loadPublishedSceneModel(
			sceneId,
			payload,
			payload.publishedModel,
			ctx,
			assetHeaders
		)
	}

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
						headers: assetHeaders,
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
				animations: result.animations,
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
			animations: result.animations,
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
		await ingestIntoOptimizer(() =>
			optimizer.loadFromServerSceneData(sceneData)
		)
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
	const { sceneId, parseMode } = source
	const { onProgress } = ctx
	const { endpoint, headers } = resolveSceneEndpoint(source)

	try {
		onProgress(0)

		const scenePayload =
			(await fetchManifestPayload(endpoint, headers)) ??
			(await fetchLegacyScenePayload(endpoint, headers, sceneId))

		return await loadModelFromSceneData(
			{ kind: 'scene-data', sceneId, sceneData: scenePayload, parseMode },
			ctx,
			headers
		)
	} catch (error) {
		throw normalizeServerLoadError(error, sceneId)
	}
}

/**
 * Statuses that describe the request itself rather than the manifest's shape.
 * Falling back to the legacy POST for these only fails a second time, doubling
 * the requests and flattening a precise auth failure into a generic one.
 */
const NON_RECOVERABLE_MANIFEST_STATUSES = new Set([401, 403, 404])

async function fetchManifestPayload(
	endpoint: string,
	headers: HeadersInit
): Promise<ServerScenePayload | null> {
	try {
		const res = await fetch(endpoint, {
			method: 'GET',
			headers: { Accept: 'application/json', ...headers }
		})

		if (NON_RECOVERABLE_MANIFEST_STATUSES.has(res.status)) {
			throw createStructuredLoadError({
				code: res.status === 404 ? 'not_found' : 'server_load_failed',
				message: `Server responded with ${res.status} ${res.statusText}`,
				recoverable: false,
				source: 'server-load',
				context: { endpoint, status: res.status }
			})
		}

		if (!res.ok) return null

		const envelope = (await res.json()) as ApiEnvelope<ServerScenePayload>
		const candidate = (envelope.data ?? envelope) as ServerScenePayload

		if (!candidate || typeof candidate !== 'object') return null

		// A published-GLB manifest is complete on its own: no glTF document, and
		// an empty `assetRefs` when the scene has no shadow bake. Without this
		// arm the embed manifest would fail the shape check below and the loader
		// would silently re-acquire the whole editor payload over the legacy POST.
		if (candidate.publishedModel) return candidate

		if (!candidate.gltfJson) return null
		if (!candidate.assetRefs && !candidate.assetData) return null

		return candidate
	} catch (error) {
		if (isStructuredLoadError(error)) throw error
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
