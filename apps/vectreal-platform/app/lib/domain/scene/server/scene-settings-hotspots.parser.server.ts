import { ApiResponse } from '@shared/utils'

import { UUID_REGEX } from '../../../../constants/utility-constants'
import {
	hotspotArtworkAssetIdFromUrl,
	isHotspotArtworkPath,
	isHotspotPayloadUrlShape
} from '../hotspot-artwork'
import {
	isAllowedHotspotLinkUrl,
	MAX_HOTSPOT_BODY_LENGTH,
	MAX_HOTSPOT_URL_LENGTH
} from '../hotspot-urls'

import type { CameraEntry } from './scene-settings-camera.parser.server'
import type { SceneSettings } from '@vctrl/core'

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Ceiling on how many hotspots one scene can persist.
 *
 * Sized well above any authored walkthrough and well below a payload that would
 * degrade an embed: a sequenced tour runs to tens of markers, and the occlusion
 * pass is throttled to 15Hz, so the cost only becomes visible in the hundreds.
 */
const MAX_HOTSPOTS_PER_SCENE = 200

/*
  A clip id is a slug of the clip's name plus a short digest, so it is as long
  as the name. Real names are short; the bound only stops a client from
  parking unbounded text in a column per hotspot.
*/
const MAX_HOTSPOT_CLIP_ID_LENGTH = 1024

/**
 * Validates hotspot definitions, and normalizes an emptied text field to
 * absent.
 *
 * Returns a new array of new objects rather than the one it was given. The
 * normalization has to write somewhere, and writing it into the caller's
 * objects would mutate the request payload in place - including, on the
 * rejection path, every hotspot before the one that failed. Copying keeps
 * this a function of its input, which is what its callers already assume.
 */
export function normalizeHotspots(
	hotspots: SceneSettings['hotspots'],
	cameras: CameraEntry[]
): SceneSettings['hotspots'] | Response {
	if (!hotspots) return hotspots
	if (!Array.isArray(hotspots)) {
		return ApiResponse.badRequest('hotspots must be an array')
	}
	// Every hotspot mounts its own portal and takes part in the viewer's
	// occlusion raycast, which every embed visitor then pays for. A structural
	// ceiling, not a plan limit: entitlements are resolved asynchronously
	// against an organization this static parser has no handle on, and a
	// ceiling that cannot be enforced where the write happens is not a ceiling.
	if (hotspots.length > MAX_HOTSPOTS_PER_SCENE) {
		return ApiResponse.badRequest(
			`hotspots must contain at most ${MAX_HOTSPOTS_PER_SCENE} entries`
		)
	}

	// Must stay in step with HotspotStylePreset in @vctrl/core and with the
	// publisher's STYLE_PRESET_OPTIONS. This set omitted 'svg' while both of
	// those offered it, so choosing SVG rejected the entire scene save.
	const VALID_STYLE_PRESETS = new Set(['dot', 'image', 'svg'])
	const cameraIds = new Set(cameras.map((c) => c.cameraId))
	const seenSequenceIndices = new Set<number>()
	const seenIds = new Set<string>()
	const normalized: NonNullable<SceneSettings['hotspots']> = []

	for (const [i, hotspot] of hotspots.entries()) {
		if (!isRecord(hotspot)) {
			return ApiResponse.badRequest(`hotspots[${i}] must be a valid object`)
		}
		if (typeof hotspot.id !== 'string' || !hotspot.id.trim()) {
			return ApiResponse.badRequest(`hotspots[${i}].id is required`)
		}
		// The id lands in a uuid primary key. Checking it here turns a
		// stale client still minting the old `hotspot-<timestamp>` format
		// into a legible 400, rather than a Postgres cast error that fails
		// the whole scene save without naming a cause.
		if (!UUID_REGEX.test(hotspot.id)) {
			return ApiResponse.badRequest(`hotspots[${i}].id must be a UUID`)
		}
		if (seenIds.has(hotspot.id)) {
			return ApiResponse.badRequest(`hotspots has duplicate id ${hotspot.id}`)
		}
		seenIds.add(hotspot.id)
		// Rejections an author can reach from the editor are named by the
		// marker, not the index: they land in the save panel, where
		// `hotspots[3]` points at nothing the author can see. A marker with no
		// name has nothing to be named by, so that one points at how the
		// panel lists it instead. Type and shape rejections keep the index:
		// only a client bypassing the editor can produce them.
		if (typeof hotspot.name !== 'string') {
			return ApiResponse.badRequest(`hotspots[${i}].name must be a string`)
		}
		if (!hotspot.name.trim()) {
			return ApiResponse.badRequest(
				'A marker has no name (listed as "Unnamed hotspot"). Name it to save the scene'
			)
		}
		const marker = `Marker "${hotspot.name.trim()}"`
		if (hotspot.body !== undefined && hotspot.body !== null) {
			if (typeof hotspot.body !== 'string') {
				return ApiResponse.badRequest(`hotspots[${i}].body must be a string`)
			}
			if (hotspot.body.length > MAX_HOTSPOT_BODY_LENGTH) {
				return ApiResponse.badRequest(
					`${marker} has body text longer than ${MAX_HOTSPOT_BODY_LENGTH} characters (body)`
				)
			}
		}
		if (hotspot.linkUrl !== undefined && hotspot.linkUrl !== null) {
			if (typeof hotspot.linkUrl !== 'string') {
				return ApiResponse.badRequest(`hotspots[${i}].linkUrl must be a string`)
			}
			// An emptied link is a cleared link, not a bad one:
			// `isAllowedHotspotLinkUrl('')` is false, so without this branch a
			// client clearing a link by sending '' had its entire scene save
			// refused instead of the link cleared.
			if (hotspot.linkUrl.trim() && !isAllowedHotspotLinkUrl(hotspot.linkUrl)) {
				// Checked for every preset, unlike `payloadUrl`. That field is
				// gated on the preset because rows predating its rule would
				// otherwise become unsaveable; `link_url` is a new column, so
				// no stored value can fail this and there is nothing to
				// grandfather.
				return ApiResponse.badRequest(
					`${marker} has a link that is not an https URL of at most ${MAX_HOTSPOT_URL_LENGTH} characters (linkUrl)`
				)
			}
		}
		if (
			!Array.isArray(hotspot.worldPosition) ||
			hotspot.worldPosition.length !== 3 ||
			!(hotspot.worldPosition as unknown[]).every((v) => typeof v === 'number')
		) {
			return ApiResponse.badRequest(
				`hotspots[${i}].worldPosition must be [number, number, number]`
			)
		}
		if (typeof hotspot.visible !== 'boolean') {
			return ApiResponse.badRequest(`hotspots[${i}].visible must be a boolean`)
		}
		if (typeof hotspot.internalOnly !== 'boolean') {
			return ApiResponse.badRequest(
				`hotspots[${i}].internalOnly must be a boolean`
			)
		}
		if (!VALID_STYLE_PRESETS.has(hotspot.stylePreset as string)) {
			return ApiResponse.badRequest(
				`hotspots[${i}].stylePreset must be 'dot', 'image' or 'svg'`
			)
		}
		if (hotspot.payloadUrl !== undefined && hotspot.payloadUrl !== null) {
			// Shape and size hold for every preset. The column is unbounded
			// `text` and is read back into every manifest whatever the preset
			// says, so a 'dot' marker carrying megabytes of dead string is the
			// same row bloat the hotspot ceiling above exists to stop.
			if (typeof hotspot.payloadUrl !== 'string') {
				return ApiResponse.badRequest(
					`hotspots[${i}].payloadUrl must be a string`
				)
			}
			if (hotspot.payloadUrl.length > MAX_HOTSPOT_URL_LENGTH) {
				return ApiResponse.badRequest(
					`${marker} has an asset URL longer than ${MAX_HOTSPOT_URL_LENGTH} characters (payloadUrl)`
				)
			}
			// The scheme is checked only for the presets that render it. A 'dot'
			// marker never reaches an `<img src>`, so rejecting a legacy value
			// there would make an existing scene unsaveable with no field on
			// screen to correct.
			// An uploaded artwork path passes on its shape here; which scene it
			// names and whether the save links its asset are checked with the
			// commit's asset ids, in `checkHotspotArtwork`.
			if (
				hotspot.stylePreset !== 'dot' &&
				!isHotspotPayloadUrlShape(hotspot.payloadUrl)
			) {
				return ApiResponse.badRequest(
					`${marker} has an asset URL that is neither https nor an inline image (payloadUrl)`
				)
			}
		}
		if (
			hotspot.occlusionEnabled !== undefined &&
			typeof hotspot.occlusionEnabled !== 'boolean'
		) {
			return ApiResponse.badRequest(
				`hotspots[${i}].occlusionEnabled must be a boolean`
			)
		}
		if (
			hotspot.linkedCameraId !== undefined &&
			hotspot.linkedCameraId !== null
		) {
			if (typeof hotspot.linkedCameraId !== 'string') {
				return ApiResponse.badRequest(
					`hotspots[${i}].linkedCameraId must be a string`
				)
			}
			if (!cameraIds.has(hotspot.linkedCameraId)) {
				return ApiResponse.badRequest(
					`hotspots[${i}].linkedCameraId references unknown camera '${hotspot.linkedCameraId}'`
				)
			}
		}
		/*
		  Shape only. The server never sees the model's clips, and the viewer
		  plays nothing for an id that matches none, the same leniency it shows
		  a drifted animation config.
		*/
		if (
			hotspot.linkedAnimationClipId !== undefined &&
			hotspot.linkedAnimationClipId !== null
		) {
			if (
				typeof hotspot.linkedAnimationClipId !== 'string' ||
				!hotspot.linkedAnimationClipId.trim() ||
				hotspot.linkedAnimationClipId.length > MAX_HOTSPOT_CLIP_ID_LENGTH
			) {
				return ApiResponse.badRequest(
					`hotspots[${i}].linkedAnimationClipId must be a non-empty string of at most ${MAX_HOTSPOT_CLIP_ID_LENGTH} characters`
				)
			}
		}
		if (hotspot.sequenceIndex !== undefined && hotspot.sequenceIndex !== null) {
			if (
				typeof hotspot.sequenceIndex !== 'number' ||
				!Number.isInteger(hotspot.sequenceIndex) ||
				hotspot.sequenceIndex < 0
			) {
				return ApiResponse.badRequest(
					`hotspots[${i}].sequenceIndex must be a non-negative integer`
				)
			}
			if (seenSequenceIndices.has(hotspot.sequenceIndex)) {
				return ApiResponse.badRequest(
					`hotspots has duplicate sequenceIndex ${hotspot.sequenceIndex}`
				)
			}
			seenSequenceIndices.add(hotspot.sequenceIndex)
		}

		/*
		  Cleared, not empty.

		  The panel writes `undefined` when an author empties a field, but a
		  client that normalizes to '' has to land in the same place: the
		  unsaved-changes comparison folds absent and null together and
		  deliberately does NOT fold in the empty string, so an '' stored
		  against a null column would report the scene dirty on every load
		  and offer a save that changes nothing. Doing it here is what makes
		  that comparison's stated premise - that no producer sends one -
		  true rather than hopeful.
		*/
		const text = (value: unknown) =>
			typeof value === 'string' && value.trim() ? value : undefined

		normalized.push({
			...hotspot,
			body: text(hotspot.body),
			linkUrl: text(hotspot.linkUrl)
		} as NonNullable<SceneSettings['hotspots']>[number])
	}

	return normalized
}

export function checkHotspotArtwork(
	hotspots: SceneSettings['hotspots'],
	sceneId: string | undefined,
	sceneAssetIds: string[]
): Response | null {
	/*
	  The thumbnail's rule, for the same reason: an artwork path is a
	  reference to an asset, and stored unexamined it could name any asset id
	  at all - another scene's, or one this scene never linked. Checked for
	  every preset, since a stored path outlives a switch back to a dot.
	*/
	for (const hotspot of hotspots ?? []) {
		const payloadUrl = hotspot.payloadUrl
		if (!payloadUrl || !isHotspotArtworkPath(payloadUrl)) continue

		const assetId =
			sceneId !== undefined
				? hotspotArtworkAssetIdFromUrl(sceneId, payloadUrl)
				: null
		if (assetId === null || !sceneAssetIds.includes(assetId)) {
			return ApiResponse.badRequest(
				`Marker "${hotspot.name.trim()}" has artwork this save does not include. Upload it again (payloadUrl)`
			)
		}
	}

	return null
}
