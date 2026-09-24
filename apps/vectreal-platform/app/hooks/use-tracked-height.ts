import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * The element's border-box height, for a wrapper that animates to it.
 *
 * A height set from `auto` to `auto` cannot transition, so a box whose content
 * changes jumps. A wrapper given this height in pixels can, while the element
 * itself stays free to be as tall as its content or its aspect ratio says.
 *
 * `animate` is false on the first reading, so the page never opens mid-growth,
 * and whenever the width changed too: a resize or a rotation is the reader
 * moving the page, and a height trailing behind it reads as lag.
 */
export function useTrackedHeight(ref: RefObject<HTMLElement | null>) {
	const [box, setBox] = useState<{ height: number; animate: boolean }>()

	useLayoutEffect(() => {
		const el = ref.current
		if (!el) return

		let width: number | undefined
		const observer = new ResizeObserver(([entry]) => {
			const { inlineSize, blockSize } = entry.borderBoxSize[0]
			setBox({ height: blockSize, animate: width === inlineSize })
			width = inlineSize
		})
		observer.observe(el)
		return () => observer.disconnect()
	}, [ref])

	return box
}
