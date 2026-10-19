import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import { ArrowDown, ArrowRight } from 'lucide-react'
import {
	Fragment,
	lazy,
	Suspense,
	useEffect,
	useRef,
	useState,
	type CSSProperties,
	type MouseEvent,
	type RefObject
} from 'react'
import { Link } from 'react-router'

import { HERO_POSTERS } from './hero-assets'
import { ArrowLink } from '../arrow-link'
import { FigureLabel, Readout } from './hero-readout'
import styles from './hero-sheet.module.css'
import {
	createHeroStore,
	fallBackToPoster,
	useHeroState,
	type HeroStore
} from './hero-store'
import { useMountWhenVisibleAndIdle } from './use-mount-when-visible-and-idle'
import {
	HOME_PAGE_COPY,
	PILOT_CONTACT_HREF
} from '../../../constants/product-copy'
import {
	HERO_SOURCE_SAMPLE_ID,
	publisherSampleHref
} from '../../../lib/samples/sample-models'
import { StageBoundary } from '../stage/stage-boundary'

import type { HeroStageElements } from './hero-stage-client'

const HeroStageClient = lazy(() => import('./hero-stage-client'))

const HERO = HOME_PAGE_COPY.hero
const COPY = HOME_PAGE_COPY.stage

/*
  Set on the section by the server, so the first paint already has the poster in
  its frame; nothing here waits on script.
*/
const SHEET_VARS = {
	...Object.fromEntries(
		Object.entries(HERO_POSTERS).flatMap(([framing, { url, ink }]) => [
			[`--poster-${framing}`, `url("${url}")`],
			...Object.entries(ink).map(([edge, v]) => [
				`--ink-${edge}-${framing}`,
				String(v)
			])
		])
	)
} as CSSProperties

/**
 * The home page's first fold: the headline beside a drawing sheet on which the
 * hero model is drawn, then rendered, then handed to the visitor to turn.
 *
 * Everything a reader needs is server-rendered and complete without script: the
 * copy, the poster of the model's elevation, and the readout of what the file
 * holds. The live stage mounts over the poster after hydration, when the
 * browser is idle and the stage is on screen, so neither three.js nor the model
 * download ever competes with the first paint. If WebGL, the chunk or the model
 * fails, the boundary drops the stage and the poster simply stays.
 */
export function HeroSheet() {
	const [store] = useState(createHeroStore)
	const [elements, setElements] = useState<HeroStageElements | null>(null)
	const openFileRef = useRef<(() => void) | null>(null)
	const handOffRef = useRef<(() => Promise<void>) | null>(null)

	const sheetRef = useRef<HTMLDivElement>(null)
	const copyRef = useRef<HTMLDivElement>(null)
	const stageRef = useRef<HTMLDivElement>(null)
	const frameRef = useRef<HTMLDivElement>(null)
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const dimsRef = useRef<SVGSVGElement>(null)
	const scaleRef = useRef<HTMLSpanElement>(null)
	const stageWanted = useMountWhenVisibleAndIdle(stageRef)

	useEffect(() => {
		if (!stageWanted) return
		const sheet = sheetRef.current
		const copy = copyRef.current
		const stage = stageRef.current
		const frame = frameRef.current
		const canvas = canvasRef.current
		const dims = dimsRef.current
		const scale = scaleRef.current
		if (!sheet || !copy || !stage || !frame || !canvas || !dims || !scale)
			return
		setElements({
			sheet,
			copy,
			stage,
			frame,
			canvas,
			dims,
			scale
		})
	}, [stageWanted])

	// The stage could not run at all: no WebGL, or the chunk would not load.
	const stageFailed = () => fallBackToPoster(store, frameRef.current)

	// Before the stage can take a file, the door stays a plain link to the publisher.
	const tryOwnFile = (event: MouseEvent) => {
		if (!openFileRef.current) return
		event.preventDefault()
		openFileRef.current()
	}

	return (
		<section aria-labelledby="home-heading" className={styles.outer}>
			<div ref={sheetRef} className={styles.sheet} style={SHEET_VARS}>
				{/* No surface of its own: the page's floor runs under the copy and the object alike. */}
				<div ref={copyRef} data-keep-clear className={styles.copy}>
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
						<TryItCta
							store={store}
							onTry={tryOwnFile}
							handOffRef={handOffRef}
						/>
						<Button asChild size="lg" variant="secondary">
							<Link to={PILOT_CONTACT_HREF}>{HERO.secondaryCta}</Link>
						</Button>
					</div>
				</div>

				<figure className={cn('ds-sunken', styles.figure)}>
					<div ref={stageRef} className={styles.stage} data-phase="poster">
						<div className={styles.art}>
							<div ref={frameRef} data-floor-light className={styles.frame}>
								<div className={styles.pencil} />
								<div className={styles.poster} />
								<div className={styles.front} />
							</div>
							{/* eslint-disable-next-line no-restricted-syntax -- an empty surface the stage engine draws the dimension lines into, not an icon */}
							<svg ref={dimsRef} className={styles.dims} aria-hidden="true" />
						</div>
						<canvas
							ref={canvasRef}
							className={styles.canvas}
							aria-hidden="true"
						/>
					</div>

					<div className={styles.meta}>
						<FigureLabel store={store} />
						<span
							ref={scaleRef}
							className={cn('text-eyebrow tabular-nums', styles.scale)}
						/>
					</div>

					{/*
					  Above what the file holds: a visitor with no file of their own
					  can open this one. The floor thins out behind the whole
					  caption, not the readout alone.
					*/}
					<figcaption data-keep-clear className={styles.caption}>
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

				<a href="#product-heading" className={cn('text-eyebrow', styles.cue)}>
					{HERO.foldCue}
					<ArrowDown className={styles.cueArrow} aria-hidden="true" />
				</a>

				{elements && (
					<StageBoundary onError={stageFailed}>
						<Suspense fallback={null}>
							<HeroStageClient
								store={store}
								elements={elements}
								openFileRef={openFileRef}
								handOffRef={handOffRef}
							/>
						</Suspense>
					</StageBoundary>
				)}
			</div>
		</section>
	)
}

/*
  "Try it out" is a link to the publisher until the stage is live, so it works
  without script and before the chunk arrives; once the stage can take a file
  it opens the picker instead. When a dropped file is live, the next step is
  the visitor's: the same door opens the publisher with it loaded.
*/
function TryItCta({
	store,
	onTry,
	handOffRef
}: {
	store: HeroStore
	onTry: (event: MouseEvent) => void
	handOffRef: RefObject<(() => Promise<void>) | null>
}) {
	const canHandOff = useHeroState(store, (s) => s.canHandOff)
	const [handingOff, setHandingOff] = useState(false)
	if (!canHandOff) {
		return (
			<Button asChild size="lg">
				<Link to="/publisher" viewTransition onClick={onTry}>
					{HERO.primaryCta}
					<ArrowRight aria-hidden="true" />
				</Link>
			</Button>
		)
	}
	const handOff = async () => {
		setHandingOff(true)
		try {
			await handOffRef.current?.()
		} finally {
			setHandingOff(false)
		}
	}
	return (
		<Button size="lg" disabled={handingOff} onClick={handOff}>
			{COPY.openInPublisher}
			<ArrowRight aria-hidden="true" />
		</Button>
	)
}
