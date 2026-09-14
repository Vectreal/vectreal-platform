import { toSerializedAssetBytes } from '@vctrl/core'
import { useEffect, useState } from 'react'

import type { SerializedSceneAssetDataMap } from '../types/api'

/** A thumbnail URL for each image asset, by asset id. */
export type TextureThumbnailUrls = Readonly<Record<string, string>>

const NO_URLS: TextureThumbnailUrls = {}

/**
 * Object URLs for a scene's image assets, made once from bytes already in memory.
 *
 * **Why the bytes stop here.** The scene page used to pass `assetData` - every
 * asset's raw bytes - down four components' props so the asset list could draw
 * thumbnails. React 19.2 logs each component render to the Performance panel in
 * development, and for props that changed it lists them, recursing into objects
 * down to three levels. `assetData.<id>.data` is a `Uint8Array` at exactly that
 * depth, so React visited every byte, once per component in the chain. For a
 * scene with 27 MB of textures that was a single 40-second task: the tab froze
 * on every load, and the development build was the only one it could happen in,
 * which is why nothing in staging or production showed it.
 *
 * Nothing below the page needs the bytes. It needs something an `<img>` can
 * point at, and a short string is a prop React can log for free.
 *
 * **Why object URLs rather than `data:` URLs.** The thumbnails were base64
 * strings built one byte at a time - about 1.5 seconds for those three textures
 * on every recomputation - and a 14 MB PNG became a 19 MB attribute in the DOM.
 * An object URL is a few dozen characters and costs one native copy of the
 * bytes into the Blob, held until the URL is revoked; for that scene, about
 * 27 MB for as long as the page is open.
 *
 * Created in an effect, not a memo, because each URL must be revoked. A memo
 * cannot own a cleanup, and StrictMode runs effect cleanups between its two
 * setups in development - a memoized URL revoked by that cleanup would stay
 * cached and render a broken image.
 */
export function useTextureThumbnailUrls(
	assetData: SerializedSceneAssetDataMap | null | undefined
): TextureThumbnailUrls {
	const [urls, setUrls] = useState<TextureThumbnailUrls>(NO_URLS)

	useEffect(() => {
		if (!assetData) {
			setUrls(NO_URLS)
			return
		}

		const created: Record<string, string> = {}
		for (const [assetId, entry] of Object.entries(assetData)) {
			if (!entry?.mimeType?.startsWith('image/')) continue

			const bytes = toSerializedAssetBytes(entry)
			if (bytes.length === 0) continue

			created[assetId] = URL.createObjectURL(
				new Blob([bytes as Uint8Array<ArrayBuffer>], { type: entry.mimeType })
			)
		}

		setUrls(created)

		return () => {
			for (const url of Object.values(created)) {
				URL.revokeObjectURL(url)
			}
		}
	}, [assetData])

	return urls
}
