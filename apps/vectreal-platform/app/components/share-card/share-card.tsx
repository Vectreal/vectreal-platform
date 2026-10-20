import { VectrealLogoAnimated } from '@shared/components/assets/icons/vectreal-logo-animated'
import { useEffect, useRef } from 'react'

import styles from './share-card.module.css'
import { createDraftingBackdrop } from '../layout-components/drafting-backdrop-engine'

import type { ShareCard as ShareCardDefinition } from '../../lib/share-cards'

/**
 * One share card, as `scripts/bake-share-cards.ts` captures it. No route
 * renders it: the bake loads `share-card-bake.tsx` from the dev server.
 *
 * The floor is the page heads' own engine, drawn once as a still frame. It
 * starts after the fonts have loaded, because it reads the text's boxes to keep
 * clear of them and a late font would move the text out from under the gap.
 */
export function ShareCard({
	eyebrow,
	caption
}: Omit<ShareCardDefinition, 'slug'>) {
	const cardRef = useRef<HTMLDivElement>(null)
	const floorRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const host = cardRef.current
		const canvas = floorRef.current
		if (!host || !canvas) return
		let dispose: (() => void) | undefined
		let cancelled = false
		document.fonts.ready.then(() => {
			if (cancelled) return
			dispose = createDraftingBackdrop(canvas, {
				reducedMotion: true,
				host,
				view: () => ({ horizon: 0.5, focusX: 0.5 })
			})?.dispose
		})
		return () => {
			cancelled = true
			dispose?.()
		}
	}, [])

	return (
		<div ref={cardRef} className={styles.card}>
			<canvas ref={floorRef} aria-hidden="true" className={styles.floor} />
			<VectrealLogoAnimated
				animated={false}
				colored
				className={styles.wordmark}
			/>
			{eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
			<h1 className={styles.caption}>{caption}</h1>
		</div>
	)
}
