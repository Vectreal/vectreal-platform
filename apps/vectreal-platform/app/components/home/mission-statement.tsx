import { cn } from '@shared/utils'
import {
	useEffect,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode
} from 'react'

import { CameraDrawing, CameraObject } from './camera-drawing'
import { inUnitOf } from './format-bytes'
import styles from './mission-statement.module.css'
import { HOME_PAGE_COPY } from '../../constants/product-copy'
import { HERO_MODEL } from '../../lib/samples/sample-models'

const COPY = HOME_PAGE_COPY.mission

const size = (bytes: number) => {
	const { value, unit } = inUnitOf(bytes, bytes)
	return `${value} ${unit}`
}

/*
  Back to front, the path the statement describes: the file as it arrives, the
  same file prepared, and the result on a page. The sizes are the hero camera's
  own, read from the sample record the spec pins to the files.
*/
const LAYERS: { label: string; value?: string; art: ReactNode }[] = [
	{
		label: COPY.layers.file,
		value: size(HERO_MODEL.sourceBytes),
		art: <CameraDrawing pencil />
	},
	{
		label: COPY.layers.prepared,
		value: size(HERO_MODEL.bytes),
		art: <CameraDrawing />
	},
	{ label: COPY.layers.page, art: <CameraObject /> }
]

/**
 * Why the company exists: one paragraph, and beside it the path it names.
 *
 * The figure is the hero's camera pulled apart, the way an exploded drawing
 * separates an assembly: the file you have, the file prepared, the product on
 * your page. The statement says what the company is for; the figure says the
 * same thing to someone who reads pictures first, so the words can be set as a
 * caption instead of carrying the section alone.
 *
 * The layers arrive stacked and separate as the section comes into view. The
 * page is complete without that: rendered apart, it is only closed while it
 * waits below the fold, and never under reduced motion.
 */
export const MissionStatement = () => {
	const ref = useRef<HTMLDivElement>(null)
	const [apart, setApart] = useState(true)

	useEffect(() => {
		const node = ref.current
		if (!node) return
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
		if (node.getBoundingClientRect().top < window.innerHeight) return
		setApart(false)
		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) return
				observer.disconnect()
				setApart(true)
			},
			// Well into the viewport, so the separation is watched rather than finished off screen.
			{ rootMargin: '100000px 0px -30% 0px' }
		)
		observer.observe(node)
		return () => observer.disconnect()
	}, [])

	return (
		<figure className="grid items-center gap-16 lg:grid-cols-[1.2fr_1fr] lg:gap-24">
			<div
				ref={ref}
				data-reveal
				data-apart={apart ? '' : undefined}
				className={styles.stack}
			>
				<div className={styles.scene}>
					{LAYERS.map((layer, i) => (
						<div
							key={layer.label}
							className={cn(styles.layer, i === 2 && styles.front)}
							style={{ '--i': i } as CSSProperties}
						>
							<div className={styles.art}>{layer.art}</div>
							<div className={styles.label}>
								<span className="text-eyebrow text-muted-foreground">
									{layer.label}
								</span>
								{layer.value && (
									<span className="text-h4 tabular-nums">{layer.value}</span>
								)}
							</div>
						</div>
					))}
				</div>
			</div>

			<div>
				<p className="text-eyebrow text-muted-foreground" data-reveal>
					{COPY.label}
				</p>
				<blockquote className="text-h4 mt-6" data-reveal>
					{COPY.statement}
				</blockquote>
				<figcaption
					data-reveal
					className="text-muted-foreground text-body-sm mt-8 flex items-center gap-4"
				>
					<span className="ds-divider h-px w-8" aria-hidden="true" />
					{COPY.signature}
				</figcaption>
			</div>
		</figure>
	)
}
