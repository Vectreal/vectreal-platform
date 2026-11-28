import { useLayoutEffect, useState, type RefObject } from 'react'

export type SettledImageStatus = 'loading' | 'loaded' | 'failed'

/**
 * Whether the image `src` names has loaded, failed or is still on its way,
 * with the handlers that tell it so.
 *
 * Until the current source has loaded the image is kept invisible: Safari
 * draws its alt text and a broken-image icon for an image that is still on
 * its way, not only for one that failed. A caller leaves a failed one out,
 * so what is behind it shows instead of a broken image.
 */
export function useSettledImage(
	imageRef: RefObject<HTMLImageElement | null>,
	src: string | undefined
) {
	const [settled, setSettled] = useState<null | {
		src: string
		loaded: boolean
	}>(null)
	const status: SettledImageStatus =
		!src || settled?.src !== src
			? 'loading'
			: settled.loaded
				? 'loaded'
				: 'failed'

	/*
	  An image can settle before React attaches its listeners: a cached one,
	  or a server-rendered one that loaded or failed before hydration. A
	  complete image with no width either failed or is an SVG with no size of
	  its own, so `decode()`, which rejects only for the broken one, decides.
	*/
	useLayoutEffect(() => {
		const image = imageRef.current
		if (!src || !image?.complete) return
		if (image.naturalWidth > 0) {
			setSettled({ src, loaded: true })
			return
		}
		let active = true
		const settle = (loaded: boolean) => {
			if (active) setSettled({ src, loaded })
		}
		if (typeof image.decode === 'function') {
			image.decode().then(
				() => settle(true),
				() => settle(false)
			)
		} else {
			settle(false)
		}
		return () => {
			active = false
		}
	}, [imageRef, src])

	return {
		status,
		onLoad: () => src && setSettled({ src, loaded: true }),
		onError: () => src && setSettled({ src, loaded: false })
	}
}
