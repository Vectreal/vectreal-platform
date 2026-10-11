import { RegistrationMark } from '@shared/components/assets/icons/registration-mark'
import { Button } from '@shared/components/ui/button'
import { cn } from '@shared/utils'
import { ArrowRight } from 'lucide-react'
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
import { ditherFadeDownMask } from '../../../lib/dither/dither'
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
  its frame and the sheet's dissolving edge; nothing here waits on script.
*/
const SHEET_VARS = {
	'--sheet-edge': ditherFadeDownMask(24),
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

const CORNERS = [styles.tl, styles.tr, styles.bl, styles.br] as const

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
	const readoutRef = useRef<HTMLElement>(null)
	const backdropRef = useRef<HTMLCanvasElement>(null)
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
		const readout = readoutRef.current
		const backdrop = backdropRef.current
		if (
			!sheet ||
			!copy ||
			!stage ||
			!frame ||
			!canvas ||
			!dims ||
			!scale ||
			!readout ||
			!backdrop
		)
			return
		setElements({
			sheet,
			copy,
			stage,
			frame,
			canvas,
			dims,
			scale,
			readout,
			backdrop
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
			<div
				ref={sheetRef}
				className={cn('ds-sunken', styles.sheet)}
				style={SHEET_VARS}
			>
				<canvas
					ref={backdropRef}
					className={styles.backdrop}
					aria-hidden="true"
				/>

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
						<Button asChild size="lg">
							<Link to={PILOT_CONTACT_HREF}>
								{HERO.primaryCta}
								<ArrowRight aria-hidden="true" />
							</Link>
						</Button>
						<OwnFileCta
							store={store}
							onTry={tryOwnFile}
							handOffRef={handOffRef}
						/>
					</div>
					<Link
						to={publisherSampleHref(HERO_SOURCE_SAMPLE_ID)}
						viewTransition
						className="text-muted-foreground hover:text-foreground text-body-sm mt-5 inline-flex w-fit items-center gap-1 underline-offset-4 transition-colors hover:underline"
					>
						{HERO.sampleCta}
						<ArrowRight className="size-3.5" aria-hidden="true" />
					</Link>
				</div>

				<figure className={cn('ds-sunken', styles.figure)}>
					<div ref={stageRef} className={styles.stage} data-phase="poster">
						<div className={styles.art}>
							<div ref={frameRef} className={styles.frame}>
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

					{CORNERS.map((corner) => (
						<RegistrationMark
							key={corner}
							className={cn(styles.mark, corner)}
						/>
					))}

					<figcaption ref={readoutRef} className={styles.readout}>
						<Readout store={store} />
					</figcaption>
				</figure>

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
  "Try it on your own file" is a link to the publisher until the stage is live,
  so it works without script and before the chunk arrives; once the stage can
  take a file it opens the picker instead. When a dropped file is live, the
  next step is the visitor's: the same door opens the publisher with it loaded.
*/
function OwnFileCta({
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
			<Button asChild size="lg" variant="secondary">
				<Link to="/publisher" viewTransition onClick={onTry}>
					{HERO.secondaryCta}
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
		<Button
			size="lg"
			variant="secondary"
			disabled={handingOff}
			onClick={handOff}
		>
			{COPY.openInPublisher}
			<ArrowRight aria-hidden="true" />
		</Button>
	)
}
