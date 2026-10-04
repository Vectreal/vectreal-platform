import { preconnect, preload } from 'react-dom'

import { resolveEmbedResourceHints } from '../../lib/domain/embed/embed-resource-hints'

import type { SceneEmbedManifestResponse } from '../../types/api'

/**
 * Puts the embed's preloads in the document head, so the model, the
 * environment map and the decoder start downloading while the page's scripts
 * are still on their way.
 *
 * Each in the CORS mode of the request it stands in for (see
 * `EmbedPreload.crossOrigin`): a preload made in any other mode is never
 * matched to it.
 */
export function EmbedResourceHints({
	manifest
}: {
	manifest: SceneEmbedManifestResponse
}) {
	const hints = resolveEmbedResourceHints(manifest)

	for (const origin of hints.preconnect) {
		preconnect(origin, { crossOrigin: 'anonymous' })
	}
	for (const hint of hints.preload) {
		preload(hint.href, {
			as: hint.as,
			crossOrigin: hint.crossOrigin ?? undefined,
			fetchPriority: hint.fetchPriority
		})
	}

	return null
}
