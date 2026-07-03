import { normalizeAssetUri } from '../scene-asset'

/**
 * Resolves a GLTFLoader-requested URL to a pre-registered object URL.
 * Tries the raw URL, the normalized URI (decoded, ./ stripped), and the
 * basename. Unknown URLs (data:, blob:, absolute) pass through untouched.
 */
export const resolveModifiedUrl = (
	urlMap: Map<string, string>,
	url: string
): string => {
	if (url.startsWith('data:') || url.startsWith('blob:')) {
		return url
	}

	const direct = urlMap.get(url)
	if (direct) return direct

	let normalized: string
	try {
		normalized = normalizeAssetUri(url)
	} catch {
		return url
	}

	const byNormalized = urlMap.get(normalized)
	if (byNormalized) return byNormalized

	const basename = normalized.split('/').pop() || normalized
	return urlMap.get(basename) ?? url
}
