import { DRACO_DECODER_PATH, resolveEnvironmentFiles } from '@vctrl/core'

import type { SceneEmbedManifestResponse } from '../../../types/api'

export interface EmbedPreload {
	href: string
	as: 'fetch' | 'image'
	fetchPriority: 'high' | 'low' | 'auto'
}

export interface EmbedResourceHints {
	/** Third-party origins to open a connection to before anything asks. */
	preconnect: string[]
	preload: EmbedPreload[]
}

/**
 * What an embed's document should start downloading before any script runs.
 *
 * Without these the browser learns of the model only once the page has
 * hydrated and the loader asks for it, and of the environment map and the
 * Draco decoder only after that. Each href is exactly what the client will
 * request, built by the same function, because a preload is reused only by a
 * request for the same URL and is otherwise a second download.
 */
export function resolveEmbedResourceHints(
	manifest: SceneEmbedManifestResponse
): EmbedResourceHints {
	const preload: EmbedPreload[] = [
		{ href: manifest.publishedModel.url, as: 'fetch', fetchPriority: 'high' }
	]

	const environment = resolveEnvironmentFiles(
		manifest.settings?.environment ?? {}
	)
	const environmentFiles = Array.isArray(environment)
		? environment
		: [environment]
	for (const href of environmentFiles) {
		preload.push({ href, as: 'fetch', fetchPriority: 'auto' })
	}

	// Only for a model known to need it. A preload nothing uses costs the
	// download and a console warning, and an older GLB that says nothing
	// either way has its decoder warmed by the loader instead.
	if (manifest.publishedModel.usesDraco === true) {
		for (const file of ['draco_wasm_wrapper.js', 'draco_decoder.wasm']) {
			preload.push({
				href: `${DRACO_DECODER_PATH}${file}`,
				as: 'fetch',
				fetchPriority: 'auto'
			})
		}
	}

	for (const ref of Object.values(manifest.assetRefs)) {
		preload.push({ href: ref.url, as: 'image', fetchPriority: 'low' })
	}

	const preconnect = [
		...new Set(
			environmentFiles
				.filter((href) => /^https?:\/\//.test(href))
				.map((href) => new URL(href).origin)
		)
	]

	return { preconnect, preload }
}
