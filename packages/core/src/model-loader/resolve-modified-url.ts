/**
 * Resolves a URL the GLTFLoader asked for to a pre-registered object URL.
 *
 * A DIRECT LOOKUP, because the map is keyed by the URI the loader will ask
 * for. `parseGLTFJsonToThreeJS` builds it from `referencedAssetNames`, one
 * entry per reference the glTF actually makes, so there is nothing left for a
 * second or third spelling to find.
 *
 * It used to try the raw URL, then the decoded one, then the bare basename,
 * against a map holding every spelling of every asset name. Both ends guessing
 * is what let two files called `diffuse.png` in sibling folders answer for one
 * another on the route the published embed takes.
 *
 * Anything not registered passes through untouched, which is what a `data:`,
 * `blob:` or absolute URL needs.
 */
export const resolveModifiedUrl = (
	urlMap: Map<string, string>,
	url: string
): string => urlMap.get(url) ?? url
