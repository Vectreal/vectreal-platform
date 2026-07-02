import type {
	SceneAssetRefMap,
	SerializedSceneAssetDataMap
} from '@vctrl/core'

export interface FetchManifestAssetsOptions {
	headers?: HeadersInit
	onProgress?: (fraction: number) => void
}

/**
 * Fetches manifest asset refs in parallel into raw byte entries.
 * Progress is byte-weighted when all sizes are known, count-weighted otherwise.
 */
export async function fetchManifestAssetData(
	assetRefs: SceneAssetRefMap,
	options: FetchManifestAssetsOptions = {}
): Promise<SerializedSceneAssetDataMap> {
	const entries = Object.entries(assetRefs)
	if (entries.length === 0) {
		options.onProgress?.(1)
		return {}
	}

	// Check if all refs have byteSize for progress calculation
	const allHaveByteSize = entries.every(([, ref]) => ref.byteSize != null)
	const totalBytes = allHaveByteSize
		? entries.reduce((total, [, ref]) => total + (ref.byteSize ?? 0), 0)
		: 0

	let loadedBytes = 0
	let loadedCount = 0
	const result: SerializedSceneAssetDataMap = {}

	// Create AbortController for aborting all fetches if one fails
	const controller = new AbortController()

	await Promise.all(
		entries.map(async ([assetId, ref]) => {
			try {
				const response = await fetch(ref.url, {
					headers: options.headers,
					credentials: 'same-origin',
					signal: controller.signal
				})

				if (!response.ok) {
					controller.abort()
					throw new Error(
						`Failed to fetch scene asset ${ref.fileName}: ${response.status}`
					)
				}

				const bytes = new Uint8Array(await response.arrayBuffer())
				result[assetId] = {
					data: bytes,
					fileName: ref.fileName,
					mimeType: ref.mimeType
				}

				loadedCount += 1
				loadedBytes += ref.byteSize ?? 0
				options.onProgress?.(
					allHaveByteSize && totalBytes > 0
						? loadedBytes / totalBytes
						: loadedCount / entries.length
				)
			} catch (error) {
				controller.abort()
				throw error
			}
		})
	)

	return result
}
