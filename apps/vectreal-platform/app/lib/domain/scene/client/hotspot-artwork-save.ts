import { createFileFromDataUrl } from './scene-draft-serialization'
import {
	buildHotspotArtworkUrl,
	canUploadHotspotArtwork,
	hotspotArtworkAssetIdFromUrl,
	hotspotArtworkFileName,
	isHotspotArtworkPath
} from '../hotspot-artwork'
import { isAllowedHotspotPayloadUrl } from '../hotspot-urls'

import type { HotspotDefinition } from '@vctrl/core'

/** What the save already holds, by file name, as `prepare-scene-upload` lists it. */
type ExistingAssets = Record<string, { assetId: string; contentHash: string }>

interface PersistHotspotArtworkParams {
	hotspots: readonly HotspotDefinition[] | undefined
	sceneId: string
	existingAssets: ExistingAssets | undefined
	/** Uploads one image as a scene asset and answers its asset id. */
	upload: (file: File) => Promise<string>
	/** Reads a stored artwork path's bytes, or null when they cannot be read. */
	readStored: (url: string) => Promise<Blob | null>
}

/** A marker whose artwork the save moved to a new address. */
export interface HotspotArtworkRewrite {
	hotspotId: string
	from: string
	to: string
}

/**
 * The editor's markers with the addresses the save gave their artwork, so the
 * next save relinks it rather than uploading the same image again. Only where
 * the marker still holds what was saved: an image picked while the save ran
 * is the author's newer choice.
 */
export function applyHotspotArtworkRewrites(
	hotspots: HotspotDefinition[],
	rewrites: readonly HotspotArtworkRewrite[]
): HotspotDefinition[] {
	if (rewrites.length === 0) return hotspots
	return hotspots.map((hotspot) => {
		const rewrite = rewrites.find(
			(entry) =>
				entry.hotspotId === hotspot.id && entry.from === hotspot.payloadUrl
		)
		return rewrite ? { ...hotspot, payloadUrl: rewrite.to } : hotspot
	})
}

/**
 * Turns every marker's artwork into something the save can commit.
 *
 * The publisher keeps a picked image on `payloadUrl` as an inline `data:` URL,
 * which previews at once and survives the draft. Small enough to pass the
 * inline cap, it stays inline. Larger, it is uploaded as a scene asset and the
 * marker gets this scene's artwork path instead, which the save links and the
 * embed serves through its own policy.
 *
 * Artwork already uploaded is relinked while the scene still holds it. When it
 * does not - the scene moved to another project, whose save reuses nothing -
 * the stored copy is read and uploaded again, the way the kept original is.
 * Unreadable, the save stops rather than silently dropping the image.
 */
export async function persistHotspotArtwork({
	hotspots,
	sceneId,
	existingAssets,
	upload,
	readStored
}: PersistHotspotArtworkParams): Promise<{
	hotspots: HotspotDefinition[] | undefined
	assetIds: string[]
	rewrites: HotspotArtworkRewrite[]
}> {
	if (!hotspots) return { hotspots, assetIds: [], rewrites: [] }

	const linkedIds = new Set(
		Object.values(existingAssets ?? {}).map((entry) => entry.assetId)
	)
	const assetIds: string[] = []
	const rewrites: HotspotArtworkRewrite[] = []

	const uploadAs = async (hotspot: HotspotDefinition, image: Blob) => {
		const file = new File(
			[image],
			hotspotArtworkFileName(hotspot.id, image.type),
			{ type: image.type }
		)
		const assetId = await upload(file)
		assetIds.push(assetId)
		const to = buildHotspotArtworkUrl(sceneId, assetId)
		rewrites.push({ hotspotId: hotspot.id, from: hotspot.payloadUrl ?? '', to })
		return to
	}

	const next: HotspotDefinition[] = []
	for (const hotspot of hotspots) {
		const payloadUrl = hotspot.payloadUrl
		const unreadable = () =>
			new Error(
				`The image on marker "${hotspot.name.trim()}" could not be read, so nothing was saved. Upload it again.`
			)

		if (
			payloadUrl?.startsWith('data:') &&
			!isAllowedHotspotPayloadUrl(payloadUrl)
		) {
			const image = createFileFromDataUrl(payloadUrl, 'artwork')
			if (!image) throw unreadable()
			if (!canUploadHotspotArtwork(image.type)) {
				throw new Error(
					`The image on marker "${hotspot.name.trim()}" is not a PNG, JPEG, WebP, GIF or SVG, so nothing was saved. Upload another image.`
				)
			}
			next.push({ ...hotspot, payloadUrl: await uploadAs(hotspot, image) })
			continue
		}

		if (payloadUrl && isHotspotArtworkPath(payloadUrl)) {
			const assetId = hotspotArtworkAssetIdFromUrl(sceneId, payloadUrl)
			if (assetId && linkedIds.has(assetId)) {
				assetIds.push(assetId)
				next.push(hotspot)
				continue
			}
			const stored = await readStored(payloadUrl)
			if (!stored) throw unreadable()
			next.push({ ...hotspot, payloadUrl: await uploadAs(hotspot, stored) })
			continue
		}

		next.push(hotspot)
	}

	return { hotspots: next, assetIds, rewrites }
}
