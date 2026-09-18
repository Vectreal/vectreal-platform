import { referenceIn, resolutionKey } from './dropped-selection'

/**
 * Which asset each reference inside a glTF means.
 *
 * ONE RULE FOR BOTH ROUTES INTO A SAVED SCENE. The editor reads a scene by
 * rebuilding it into files and going through `loadGLTFWithAssets`; the embed
 * and the dashboard viewer read the same scene through
 * `parseGLTFJsonToThreeJS`, which used to build its own map by pouring every
 * hopeful spelling of every asset name in - the whole name, its normalized
 * form and its bare basename - with last write winning. That is the map the
 * dropped-selection owner was written to replace, still live on the route the
 * published embed uses, so a scene holding `body/diffuse.png` and
 * `wheels/diffuse.png` rendered correctly to the person editing it and wore one
 * texture twice for everyone who visited the embed.
 *
 * Pure, and separate from `model-loader.ts`, because the route it serves needs
 * `URL.createObjectURL` and a three.js `LoadingManager` and so cannot be
 * reached by a test. The rule can be, and is.
 */
export function referencedAssetNames(
	gltfJson: unknown,
	assetNames: Iterable<string>
): Map<string, string> {
	const byKey = new Map<string, string>()
	for (const name of assetNames) byKey.set(resolutionKey(name), name)

	const resolved = new Map<string, string>()
	for (const uri of referencedUris(gltfJson)) {
		const name = referenceIn(byKey, uri)
		if (name !== undefined) resolved.set(uri, name)
	}

	return resolved
}

/**
 * Every URI a glTF references and expects to find beside itself.
 *
 * A data URI carries its own bytes, so it names no file and is left out; the
 * reader passes it through untouched.
 *
 * `unknown` rather than a shape, because that is what it is: on the route this
 * serves the document is JSON parsed from the API, so a declared shape would be
 * a claim rather than a check.
 */
export function referencedUris(gltfJson: unknown): Set<string> {
	const document = gltfJson as {
		images?: Array<{ uri?: string }>
		buffers?: Array<{ uri?: string }>
	}

	const uris = new Set<string>()
	for (const list of [document?.images, document?.buffers]) {
		if (!Array.isArray(list)) continue
		for (const entry of list) {
			const uri = entry?.uri
			if (typeof uri === 'string' && uri && !uri.startsWith('data:')) {
				uris.add(uri)
			}
		}
	}

	return uris
}
