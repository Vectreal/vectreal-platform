import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger
} from '@shared/components/ui/tabs'
import { cn } from '@shared/utils'
import { useEffect, useRef, useState, type CSSProperties } from 'react'

import { ArrowLink } from './arrow-link'
import { ProductPageSketch } from './product-page-sketch'
import PRODUCT_SHOTS from './product-shots.json'
import { ProductStage, type FrameRect } from './product-stage'
import styles from './product-window.module.css'
import { useRelativeRect } from './use-relative-rect'
import manageDarkUrl from '../../assets/home/product/manage-dark.webp?url'
import manageLightUrl from '../../assets/home/product/manage-light.webp?url'
import prepareDarkUrl from '../../assets/home/product/prepare-dark.webp?url'
import prepareLightUrl from '../../assets/home/product/prepare-light.webp?url'
import { HOME_PAGE_COPY } from '../../constants/product-copy'
import { dissolveIn } from '../../lib/dither/dither'
import { prefersReducedMotion } from '../../lib/motion/motion-tokens'
import { entersFunnel } from '../../lib/navigation/site-map'

const COPY = HOME_PAGE_COPY.product

type ProductView = keyof typeof COPY.views

/*
  Prepare and Embed link to what someone can use or read right now. Manage
  links to the plans, because whether a whole team gets in depends on one.
*/
const VIEW_LINKS: Record<ProductView, string> = {
	prepare: '/publisher',
	manage: '/pricing',
	embed: '/docs/guides/publish-embed'
}

const VIEW_ORDER: ProductView[] = ['prepare', 'manage', 'embed']

const isProductView = (value: string): value is ProductView =>
	value in COPY.views

/* Where the live camera stands in each screenshot, as the capture recorded it. */
const SHOTS: Record<'prepare' | 'manage', FrameRect> = PRODUCT_SHOTS

/*
  Prepare and Manage are screenshots, captured from the running app by
  `scripts/capture-home-product-shots.ts`, one per theme, and replaced in place
  when the interface moves. Imported rather than served from public, so each
  capture's URL carries a hash of its content: a fixed name under /assets was
  cached for a year at the edge and on every device, and a recapture never
  reached anyone who had seen the last one. The page shows the capture that matches the theme
  it is in, so a dark page never flashes a white screenshot. The capture also
  records where the live camera stands in each (`product-shots.json`). Embed
  is not a screenshot: it is a shop's page, which no screenshot of ours shows.
*/
const SHOT_URLS = {
	prepare: { light: prepareLightUrl, dark: prepareDarkUrl },
	manage: { light: manageLightUrl, dark: manageDarkUrl }
} as const

/** One capture per theme; the page shows the one that matches the theme it is in. */
function ThemedShot({ view }: { view: keyof typeof SHOT_URLS }) {
	const alt = `The ${COPY.views[view].label} view in the Vectreal app`
	return (
		<>
			<img
				src={SHOT_URLS[view].light}
				alt={alt}
				width={1200}
				height={750}
				loading="lazy"
				className="block h-auto w-full dark:hidden"
			/>
			<img
				src={SHOT_URLS[view].dark}
				alt={alt}
				width={1200}
				height={750}
				loading="lazy"
				className="hidden h-auto w-full dark:block"
			/>
		</>
	)
}

/** How long the dissolve between two screenshots takes, one mask frame per step. */
const DISSOLVE_MS = 400

/** How long each view stands while the window cycles on its own. */
const DWELL_MS = 7000

/**
 * The product as three steps, one view at a time.
 *
 * Tabs rather than a grid of feature cards: the three views are one workflow,
 * and showing one screen large says more than three small ones side by side.
 * Every screenshot and caption is server-rendered, and switching only changes
 * which one is shown.
 *
 * The views are the workflow's three steps, set as a row of tiles at the top
 * of the window and numbered in workflow order, so the page says how short the
 * path is before it shows any of it. The window walks through them on its own: the active step's
 * rule fills over its dwell and hands on to the next. Hovering or
 * focusing the window pauses it, so nobody loses a caption mid-read; so does
 * the window being off screen. A click hands it over to the reader for good,
 * and reduced motion never starts it.
 *
 * The screenshots share one cell, so a switch dissolves the new view over the
 * old through the page's dither rather than crossfading: the incoming shot's
 * mask steps through the matrix's seventeen states while the outgoing one
 * stays beneath it.
 */
export const ProductWindow = () => {
	const [view, setView] = useState<ProductView>('prepare')
	const [previous, setPrevious] = useState<ProductView | null>(null)
	const [cycling, setCycling] = useState(false)
	const [held, setHeld] = useState(false)
	const [offscreen, setOffscreen] = useState(true)
	const windowRef = useRef<HTMLDivElement>(null)
	const shots = useRef<Partial<Record<ProductView, HTMLDivElement | null>>>({})
	const cancelDissolve = useRef(() => {})
	const sceneRef = useRef<HTMLDivElement>(null)
	const embedSlotRef = useRef<HTMLDivElement>(null)

	// The product page is laid out by CSS, so its gallery is measured, as a share of the frame.
	const embedSlot = useRelativeRect(sceneRef, embedSlotRef)

	const stagePlace: FrameRect =
		view === 'embed' ? (embedSlot ?? SHOTS.prepare) : SHOTS[view]

	const switchTo = (next: string) => {
		if (!isProductView(next) || next === view) return
		// Cancelling also clears the mask, so a switch mid-dissolve never leaves a partly masked shot underneath.
		cancelDissolve.current()
		setView(next)
		const shot = shots.current[next]
		if (!shot || prefersReducedMotion()) {
			setPrevious(null)
			return
		}
		setPrevious(view)
		cancelDissolve.current = dissolveIn(shot, DISSOLVE_MS, () =>
			setPrevious(null)
		)
	}

	// The reader chose a view: the window stops cycling and stays where they put it.
	const choose = (next: string) => {
		setCycling(false)
		switchTo(next)
	}

	// The dwell line's animation ending is the clock: one timer, and it pauses with the line.
	// The fill also animates once when the reader chooses a step; only the dwell, which runs while cycling, is the clock.
	const advance = () => {
		if (!cycling) return
		switchTo(VIEW_ORDER[(VIEW_ORDER.indexOf(view) + 1) % VIEW_ORDER.length])
	}

	useEffect(() => {
		if (!prefersReducedMotion()) setCycling(true)
		const node = windowRef.current
		if (!node) return
		const observer = new IntersectionObserver(([entry]) =>
			setOffscreen(!entry.isIntersecting)
		)
		observer.observe(node)
		return () => {
			observer.disconnect()
			cancelDissolve.current()
		}
	}, [])

	return (
		<Tabs value={view} onValueChange={choose} className="gap-12">
			<div className="max-w-3xl">
				<h2 id="product-heading" className="text-headline" data-reveal>
					{COPY.heading.map((part) =>
						typeof part === 'string' ? (
							part
						) : (
							<span
								key={part.underline}
								className="decoration-orange underline decoration-2 underline-offset-[0.15em]"
							>
								{part.underline}
							</span>
						)
					)}
				</h2>
			</div>

			<div
				ref={windowRef}
				className={cn('flex flex-col gap-8', styles.window)}
				style={{ '--dwell': `${DWELL_MS}ms` } as CSSProperties}
				data-cycling={cycling ? '' : undefined}
				data-paused={held || offscreen ? '' : undefined}
				onPointerEnter={() => setHeld(true)}
				onPointerLeave={() => setHeld(false)}
				onFocus={() => setHeld(true)}
				onBlur={(event) => {
					if (!event.currentTarget.contains(event.relatedTarget)) setHeld(false)
				}}
			>
				<div
					data-reveal
					className="ds-raised grid gap-4 rounded-2xl p-2 md:p-3 lg:grid-cols-[1fr_18rem] lg:gap-3"
				>
					<TabsList
						aria-label={COPY.stepsLabel}
						className="grid h-auto w-full grid-cols-3 items-stretch gap-2 bg-transparent p-0 md:gap-3 lg:col-span-2"
					>
						{VIEW_ORDER.map((one, index) => (
							<TabsTrigger
								key={one}
								value={one}
								className={cn(
									/*
									  A tile in the window, its rule along a square top edge. The
									  shared trigger's pill states are forced (`!`), so the active
									  tile's step up the ladder is forced the same way; the rule
									  lives in the module.
									*/
									'text-muted-foreground hover:text-foreground data-[state=active]:text-foreground h-auto flex-col items-start justify-start gap-2 overflow-hidden rounded-t-none rounded-b-lg border-0 px-2 pt-4 pb-3 text-left whitespace-normal shadow-none transition-colors hover:bg-[color-mix(in_oklch,var(--foreground)_8%,var(--background))] data-[state=active]:bg-[color-mix(in_oklch,var(--foreground)_8%,var(--background))]! data-[state=active]:shadow-none md:px-4 md:pt-5 md:pb-4 dark:data-[state=active]:border-transparent',
									styles.step
								)}
							>
								{/* Number over label on a phone: three tiles across leave no room for both on one line. */}
								<span className="flex flex-col gap-1 md:flex-row md:items-baseline md:gap-3">
									<span className="text-eyebrow text-orange-ink tabular-nums">
										{String(index + 1).padStart(2, '0')}
									</span>
									<span className="text-h3">{COPY.views[one].label}</span>
								</span>
								<span className="text-body-sm text-muted-foreground hidden md:block">
									{COPY.views[one].summary}
								</span>
								<span
									className={styles.fill}
									aria-hidden="true"
									onAnimationEnd={advance}
								/>
							</TabsTrigger>
						))}
					</TabsList>

					{/* Concentric with the window: its 28px corner less the padding between them. */}
					<div
						ref={sceneRef}
						className="relative grid overflow-hidden rounded-xl md:rounded-lg"
					>
						{VIEW_ORDER.map((one) => (
							<div
								key={one}
								ref={(node) => {
									shots.current[one] = node
								}}
								aria-hidden={one !== view}
								// Invisible rather than hidden: the product page's gallery is measured while it waits.
								className={cn(
									'[grid-area:1/1]',
									one === view ? 'z-1' : one !== previous && 'invisible'
								)}
							>
								{one === 'embed' ? (
									<ProductPageSketch
										gallery={
											<div ref={embedSlotRef} className="absolute inset-0" />
										}
									/>
								) : (
									<ThemedShot view={one} />
								)}
							</div>
						))}
						<div className="pointer-events-none absolute inset-0 z-2 *:pointer-events-auto">
							<ProductStage
								visible={!offscreen}
								place={stagePlace}
								hint={view === 'embed'}
							/>
						</div>
					</div>

					{VIEW_ORDER.map((one) => (
						<TabsContent
							key={one}
							value={one}
							forceMount
							className="flex flex-col gap-4 px-4 pt-2 pb-4 data-[state=inactive]:hidden lg:pt-4"
						>
							<p className="text-eyebrow text-muted-foreground">
								{COPY.views[one].label}
							</p>
							<p className="text-muted-foreground text-body">
								{COPY.views[one].body}
							</p>
							<ArrowLink
								to={VIEW_LINKS[one]}
								viewTransition={entersFunnel(VIEW_LINKS[one])}
								className="text-foreground"
							>
								{COPY.views[one].link}
							</ArrowLink>
						</TabsContent>
					))}
				</div>
			</div>
		</Tabs>
	)
}
