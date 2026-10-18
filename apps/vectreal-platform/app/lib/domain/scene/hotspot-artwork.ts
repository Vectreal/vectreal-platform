import {
	HOTSPOT_IMAGE_MEDIA_TYPES,
	isAllowedHotspotPayloadUrl
} from './hotspot-urls'

/**
 * The one shape uploaded marker artwork takes, read by every side that handles
 * it: the publisher that uploads it, the save parser that admits it, the editor
 * manifest that must not download it as model data, and the embed policy that
 * decides whether an anonymous visitor may fetch it.
 *
 * A marker's `payloadUrl` holds this scene's own asset path for its artwork,
 * the address the editor manifest already gives every scene asset. That keeps
 * the artwork on the platform: an embed visitor's browser never calls a host
 * the author chose, and an outage of that host cannot blank the marker.
 *
 * Pure, with no database import, so it reaches the browser bundle and a test.
 */

/**
 * Every uploaded artwork file is named with this prefix, then the marker's id
 * and an image extension.
 *
 * The name is what identifies an asset row as artwork, and it can carry that
 * weight because upload deduplication matches the name AND the content hash
 * (`findExistingAsset`): a model texture with identical bytes is still its own
 * row under its own name. The whole shape is matched, not the prefix alone,
 * because a texture's name comes from whatever file the author uploaded, and a
 * texture read as artwork would be left out of the model and fail its load.
 */
export const HOTSPOT_ARTWORK_PREFIX = 'hotspot-artwork-'

/**
 * The largest image a marker accepts, in bytes.
 *
 * A marker draws at 28 CSS pixels, so even a crisp 3x icon is a few kilobytes.
 * The cap is generous for that, and still keeps an author from loading a
 * full-resolution photograph into every embed visitor's page for one marker.
 */
export const HOTSPOT_ARTWORK_MAX_BYTES = 2 * 1024 * 1024

const EXTENSION_BY_MEDIA_TYPE: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
	'image/gif': 'gif',
	'image/svg+xml': 'svg'
}

/** Whether an image of this type can be uploaded as marker artwork. */
export function canUploadHotspotArtwork(mediaType: string): boolean {
	return mediaType.toLowerCase() in EXTENSION_BY_MEDIA_TYPE
}

/** The name a marker's uploaded artwork is stored under. */
export function hotspotArtworkFileName(
	hotspotId: string,
	mediaType: string
): string {
	const extension = EXTENSION_BY_MEDIA_TYPE[mediaType.toLowerCase()]
	if (!extension) {
		throw new Error(`Marker artwork cannot be a ${mediaType}`)
	}
	return `${HOTSPOT_ARTWORK_PREFIX}${hotspotId.toLowerCase()}.${extension}`
}

/** A lowercase uuid: the one form Postgres returns, so the one form compared. */
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

const ARTWORK_FILE_NAME = new RegExp(
	`^${HOTSPOT_ARTWORK_PREFIX}${UUID}\\.(${Object.values(EXTENSION_BY_MEDIA_TYPE).join('|')})$`
)

/** Whether an asset row is marker artwork: the reserved name and an image type. */
export function isHotspotArtworkAsset(asset: {
	name: string
	mimeType: string | null
}): boolean {
	return (
		ARTWORK_FILE_NAME.test(asset.name) &&
		asset.mimeType !== null &&
		HOTSPOT_IMAGE_MEDIA_TYPES.includes(asset.mimeType.toLowerCase())
	)
}

/** The `payloadUrl` a marker stores for artwork uploaded to this scene. */
export function buildHotspotArtworkUrl(
	sceneId: string,
	assetId: string
): string {
	return `/api/scenes/${sceneId}/assets/${assetId}`
}

/*
  Lowercase ids only. Postgres stores and returns a uuid in lowercase, and every
  side compares the path's id with ids read back from it, so a path the
  publisher built from a returned id always matches and any other casing is
  refused at the parser rather than silently never matching later.
*/
const ARTWORK_PATH = new RegExp(`^/api/scenes/(${UUID})/assets/(${UUID})$`)

/**
 * Whether a value has the shape of an artwork path for any scene.
 *
 * Shape only. Which scene it names, and whether that scene links the asset,
 * are decided where the scene and its links are known: the commit parser and
 * the embed policy.
 */
export function isHotspotArtworkPath(value: string): boolean {
	return ARTWORK_PATH.test(value)
}

/**
 * Whether a value has a shape a marker's `payloadUrl` may take: an inline
 * image, an `https:` address, or an uploaded artwork path. The one rule the
 * publisher's field and the save parser both read, so they cannot disagree.
 */
export function isHotspotPayloadUrlShape(value: string): boolean {
	return isAllowedHotspotPayloadUrl(value) || isHotspotArtworkPath(value)
}

/**
 * The asset id an artwork path names, or null when the value is anything else:
 * an inline image, a remote URL, or a path into a different scene.
 *
 * Anchored and exact, so a query string, a trailing segment or another scene's
 * id never yields an id.
 */
export function hotspotArtworkAssetIdFromUrl(
	sceneId: string,
	value: string | null | undefined
): string | null {
	if (!value) return null
	const match = ARTWORK_PATH.exec(value)
	if (!match || match[1] !== sceneId.toLowerCase()) return null
	return match[2]
}

/**
 * The first marker carrying a remote artwork address it did not already hold
 * when the scene was last saved, or null.
 *
 * Remote artwork makes every embed visitor's browser call a host the author
 * chose, so new artwork is uploaded instead. A remote address a marker already
 * stored keeps saving untouched until it is changed: those scenes predate the
 * rule, and refusing their saves would strand them with nothing to fix the
 * value but a new upload. Every preset, because a value saved on a dot would
 * otherwise be grandfathered the moment the marker switched to an image.
 */
export function findNewRemoteArtwork(
	hotspots:
		| readonly { id: string; name: string; payloadUrl?: string | null }[]
		| null
		| undefined,
	stored: readonly { id: string; payloadUrl?: string | null }[]
): { name: string } | null {
	const storedById = new Map(stored.map((row) => [row.id, row.payloadUrl]))

	for (const hotspot of hotspots ?? []) {
		const payloadUrl = hotspot.payloadUrl
		if (!payloadUrl || !payloadUrl.toLowerCase().startsWith('https://'))
			continue
		if (storedById.get(hotspot.id) === payloadUrl) continue
		return { name: hotspot.name }
	}

	return null
}
