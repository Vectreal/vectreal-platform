import { Button } from '@shared/components/ui/button'
import { ArrowRight } from 'lucide-react'
import {
	Fragment,
	lazy,
	Suspense,
	useEffect,
	useRef,
	useState,
	type CSSProperties
} from 'react'
import { Link } from 'react-router'

import { HERO_POSTERS, HERO_STILLS } from './hero-assets'
import { ArrowLink } from '../arrow-link'
import { FigureLabel, Readout } from './hero-readout'
import styles from './hero-sheet.module.css'
import { createHeroStore, fallBackToStill } from './hero-store'
import { useMountWhenVisibleAndIdle } from './use-mount-when-visible-and-idle'
import { HOME_PAGE_COPY } from '../../../constants/product-copy'
import {
	HERO_SOURCE_SAMPLE_ID,
	publisherSampleHref
} from '../../../lib/samples/sample-models'
import { StageBoundary } from '../stage/stage-boundary'

import type { HeroStageElements } from './hero-stage-client'

const HeroStageClient = lazy(() => import('./hero-stage-client'))

const HERO = HOME_PAGE_COPY.hero

/*
  The drawing's ink bounds, set on the section by the server: the frame box is
  held to the room beside the copy by the drawn width of the model, so the
  still and the live stage sit where they always have.
*/
const SHEET_VARS = Object.fromEntries(
	Object.entries(HERO_POSTERS).flatMap(([framing, { ink }]) =>
		(['l', 'r'] as const).map((edge) => [
			`--ink-${edge}-${framing}`,
			String(ink[edge])
		])
	)
) as CSSProperties

/**
 * The home page's first fold: the headline beside the hero model, shown at
 * once as a still and then handed to the visitor to turn.
 *
 * Everything a reader needs is server-rendered and complete without script: the
 * copy, the still of the model, and the readout of what the file holds. The
 * live stage mounts over the still after hydration, when the browser is idle
 * and the stage is on screen, so neither three.js nor the model download ever
 * competes with the first paint; it draws the still's own frame before the
 * still goes, then turns the model into place. If WebGL, the chunk or the
 * model fails, the boundary drops the stage and the still simply stays.
 */
export function HeroSheet() {
	const [store] = useState(createHeroStore)
	const [elements, setElements] = useState<HeroStageElements | null>(null)

	const sheetRef = useRef<HTMLDivElement>(null)
	const copyRef = useRef<HTMLDivElement>(null)
	const stageRef = useRef<HTMLDivElement>(null)
	const frameRef = useRef<HTMLDivElement>(null)
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const captionRef = useRef<HTMLElement>(null)
	const stageWanted = useMountWhenVisibleAndIdle(stageRef)

	// The stage runs on under the readout row to the fold's edge, so the floor does. How far that is depends on the readout's type, so it is measured; the stylesheet's default holds until then.
	useEffect(() => {
		const sheet = sheetRef.current
		const caption = captionRef.current
		if (!sheet || !caption) return
		const measure = () => {
			const below =
				sheet.getBoundingClientRect().bottom -
				caption.getBoundingClientRect().top
			sheet.style.setProperty('--below', `${Math.round(below)}px`)
		}
		const observer = new ResizeObserver(measure)
		observer.observe(sheet)
		observer.observe(caption)
		return () => observer.disconnect()
	}, [])

	useEffect(() => {
		if (!stageWanted) return
		const copy = copyRef.current
		const stage = stageRef.current
		const frame = frameRef.current
		const canvas = canvasRef.current
		if (!copy || !stage || !frame || !canvas) return
		setElements({ copy, stage, frame, canvas })
	}, [stageWanted])

	// The stage could not run at all: no WebGL, or the chunk would not load.
	const stageFailed = () => fallBackToStill(store)

	return (
		<section aria-labelledby="home-heading" className={styles.outer}>
			<div ref={sheetRef} className={styles.sheet} style={SHEET_VARS}>
				<div ref={copyRef} className={styles.copy}>
					<h1 id="home-heading" className="text-display">
						{/* The space keeps the lines apart in the text itself, for copy and search. */}
						{HERO.heading.map((line, i) => (
							<Fragment key={line}>
								{i > 0 && ' '}
								<span className="block">{line}</span>
							</Fragment>
						))}
					</h1>
					<p className="text-muted-foreground text-body-lg mt-8 max-w-xl">
						{HERO.lead}
					</p>
					<div className="mt-8 flex flex-col gap-4 sm:flex-row">
						<Button asChild size="lg" className="tap-target relative">
							<Link to="/free-model">
								{HERO.primaryCta}
								<ArrowRight aria-hidden="true" />
							</Link>
						</Button>
						<Button
							asChild
							size="lg"
							variant="secondary"
							className="tap-target relative"
						>
							<Link to="/publisher" viewTransition>
								{HERO.secondaryCta}
							</Link>
						</Button>
					</div>
				</div>

				<figure className={styles.figure}>
					<div ref={stageRef} className={styles.stage} data-phase="still">
						<div className={styles.art}>
							<div ref={frameRef} className={styles.frame}>
								{/* The page's largest image, so it is fetched first; each framing takes its own, at the stylesheet's breakpoint. The readout describes it. */}
								<picture className={styles.still}>
									<source
										media="(max-width: 899px)"
										srcSet={HERO_STILLS.fold.url}
										width={HERO_STILLS.fold.width}
										height={HERO_STILLS.fold.height}
									/>
									<img
										src={HERO_STILLS.sheet.url}
										width={HERO_STILLS.sheet.width}
										height={HERO_STILLS.sheet.height}
										alt=""
										fetchPriority="high"
									/>
								</picture>
							</div>
						</div>
						<canvas
							ref={canvasRef}
							className={styles.canvas}
							aria-hidden="true"
						/>
					</div>

					<div className={styles.meta}>
						<FigureLabel store={store} />
					</div>

					{/* Above what the file holds: a visitor with no file of their own can open this one. */}
					<figcaption ref={captionRef} className={styles.caption}>
						<ArrowLink
							to={publisherSampleHref(HERO_SOURCE_SAMPLE_ID)}
							viewTransition
							className="text-muted-foreground hover:text-foreground transition-colors"
						>
							{HERO.sampleCta}
						</ArrowLink>
						<div className={styles.readout}>
							<Readout store={store} />
						</div>
					</figcaption>
				</figure>

				<a href="#product-heading" className={styles.cue}>
					<span className={styles.cueTrack} aria-hidden="true" />
					{HERO.foldCue}
				</a>

				{elements && (
					<StageBoundary onError={stageFailed}>
						<Suspense fallback={null}>
							<HeroStageClient store={store} elements={elements} />
						</Suspense>
					</StageBoundary>
				)}
			</div>
		</section>
	)
}
