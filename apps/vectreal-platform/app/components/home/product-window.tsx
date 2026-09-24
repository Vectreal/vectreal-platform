import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger
} from '@shared/components/ui/tabs'
import { cn } from '@shared/utils'
import { ArrowRight } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'

import styles from './product-window.module.css'
import { HOME_PAGE_COPY } from '../../constants/product-copy'
import { dissolveIn } from '../../lib/dither/dither'

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

/*
  Captured from the running app by `scripts/capture-home-product-shots.ts`, one
  per theme, and replaced in place when the interface moves. The page shows the
  capture that matches the theme it is in, so a dark page never flashes a white
  screenshot.
*/
const shotPath = (view: ProductView, theme: 'light' | 'dark') =>
	`/assets/images/product/${view}-${theme}.webp`

/** How long the dissolve between two screenshots takes, one mask frame per step. */
const DISSOLVE_MS = 400

/** How long each view stands while the window cycles on its own. */
const DWELL_MS = 7000

/**
 * The product as it is today, one view at a time.
 *
 * Tabs rather than a grid of feature cards: the three views are one workflow,
 * and showing one screen large says more than three small ones side by side.
 * Every screenshot and caption is server-rendered, and switching only changes
 * which one is shown.
 *
 * The views are listed inside the window, beside the screenshot, numbered in
 * workflow order, and the window walks through them on its own: a line under
 * the active view fills over its dwell and hands on to the next. Hovering or
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

	const switchTo = (next: string) => {
		if (!isProductView(next) || next === view) return
		// Cancelling also clears the mask, so a switch mid-dissolve never leaves a partly masked shot underneath.
		cancelDissolve.current()
		setView(next)
		const shot = shots.current[next]
		if (
			!shot ||
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		) {
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
	const advance = () =>
		switchTo(VIEW_ORDER[(VIEW_ORDER.indexOf(view) + 1) % VIEW_ORDER.length])

	useEffect(() => {
		if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
			setCycling(true)
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
		<Tabs
			value={view}
			onValueChange={choose}
			orientation="vertical"
			className="gap-8"
		>
			<div className="max-w-xl">
				<h2 id="product-heading" className="text-h2" data-reveal="wipe">
					{COPY.heading}
				</h2>
				<p
					className="text-muted-foreground text-body-lg mt-4"
					data-reveal="fade"
				>
					{COPY.lead}
				</p>
			</div>

			<div
				ref={windowRef}
				data-reveal="fade"
				className={cn('ds-raised rounded-2xl p-2 md:p-3', styles.window)}
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
				<div className="grid gap-4 lg:grid-cols-[1fr_18rem] lg:gap-3">
					{/* Concentric with the window: its 28px corner less the padding between them. */}
					<div className="grid overflow-hidden rounded-xl md:rounded-lg">
						{VIEW_ORDER.map((one) => (
							<div
								key={one}
								ref={(node) => {
									shots.current[one] = node
								}}
								hidden={one !== view && one !== previous}
								aria-hidden={one !== view}
								className={cn('[grid-area:1/1]', one === view && 'z-1')}
							>
								<img
									src={shotPath(one, 'light')}
									alt={`The ${COPY.views[one].label} view in the Vectreal app`}
									width={1200}
									height={750}
									loading="lazy"
									className="block h-auto w-full dark:hidden"
								/>
								<img
									src={shotPath(one, 'dark')}
									alt={`The ${COPY.views[one].label} view in the Vectreal app`}
									width={1200}
									height={750}
									loading="lazy"
									className="hidden h-auto w-full dark:block"
								/>
							</div>
						))}
					</div>

					<div className="flex flex-col gap-6 pb-2">
						<TabsList
							aria-label={COPY.heading}
							className="grid h-auto w-full grid-cols-3 gap-1 bg-transparent p-0 lg:grid-cols-1"
						>
							{VIEW_ORDER.map((one, index) => (
								<TabsTrigger
									key={one}
									value={one}
									className={cn(
										// The shared trigger's pill states are forced (`!`), so they are cleared the same way; the row styles live in the module.
										'text-muted-foreground hover:text-foreground data-[state=active]:text-foreground h-auto justify-start border-0 px-4 py-3 text-left shadow-none data-[state=active]:bg-transparent! data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent',
										styles.view
									)}
								>
									<span className="text-eyebrow tabular-nums">
										{String(index + 1).padStart(2, '0')}
									</span>
									<span className="text-h4 ml-3">{COPY.views[one].label}</span>
									<span
										className={styles.fill}
										aria-hidden="true"
										onAnimationEnd={advance}
									/>
								</TabsTrigger>
							))}
						</TabsList>

						{VIEW_ORDER.map((one) => (
							<TabsContent
								key={one}
								value={one}
								forceMount
								className="flex flex-col gap-4 px-4 data-[state=inactive]:hidden"
							>
								<p className="text-muted-foreground text-body">
									{COPY.views[one].body}
								</p>
								<Link
									to={VIEW_LINKS[one]}
									className="text-foreground text-body-sm inline-flex w-fit items-center gap-1 underline-offset-4 hover:underline"
								>
									{COPY.views[one].link}
									<ArrowRight className="size-3.5" aria-hidden="true" />
								</Link>
							</TabsContent>
						))}
					</div>
				</div>
			</div>
		</Tabs>
	)
}
