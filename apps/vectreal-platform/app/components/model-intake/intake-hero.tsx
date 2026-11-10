import { cn } from '@shared/utils'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { useMountWhenVisibleAndIdle } from '../home/hero/use-mount-when-visible-and-idle'

import type { IntakeScene } from '../../lib/domain/model-intake/model-intake-scene.server'

interface IntakeHeroProps {
	/** Opens the hero for a visit from one of our letters. */
	greeting?: string | null
	heading: ReactNode
	/** One sentence. */
	lead: ReactNode
	scene: IntakeScene | null
	/** Names the scene for a screen reader when the scene has no name of its own. */
	sceneLabel: string
	action: ReactNode
}

/**
 * The top of a letter page, built for the phone the letter was scanned with:
 * the headline, one sentence, the product turning and the button all fit the
 * first screen at 390 px. On a wide screen the product moves beside the text.
 */
export function IntakeHero({
	greeting,
	heading,
	lead,
	scene,
	sceneLabel,
	action
}: IntakeHeroProps) {
	return (
		<section className="container-page grid gap-5 pt-16 pb-12 lg:grid-cols-2 lg:items-center lg:gap-x-16 lg:pt-32 lg:pb-20">
			<div className="space-y-3 lg:col-start-1">
				{greeting ? (
					<p className="text-body-sm text-muted-foreground">{greeting}</p>
				) : null}
				<h1 className="text-headline">{heading}</h1>
				<p className="text-muted-foreground text-body max-w-2xl lg:text-[length:var(--text-body-lg)]">
					{lead}
				</p>
			</div>
			{scene ? (
				<div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
					<IntakeProductScene scene={scene} label={sceneLabel} />
				</div>
			) : null}
			<div className="flex flex-wrap items-center gap-3 lg:col-start-1">
				{action}
			</div>
		</section>
	)
}

/**
 * The published scene, through its own embed: the product a shop would show,
 * with no viewer code in this page's bundle.
 *
 * The scene's thumbnail paints with the document; the embed mounts once the
 * frame is on screen and the browser is idle, and replaces the poster only
 * when the viewer says it is ready, so nobody sees an empty box. On a touch
 * screen the frame takes no
 * touch, so a finger on the product scrolls the page, as in the scene tour.
 */
function IntakeProductScene({
	scene,
	label
}: {
	scene: IntakeScene
	label: string
}) {
	const frameRef = useRef<HTMLDivElement>(null)
	const iframeRef = useRef<HTMLIFrameElement>(null)
	const visible = useMountWhenVisibleAndIdle(frameRef)
	// As the gallery slide does: a browser asking to save data keeps the poster.
	const wanted =
		visible &&
		!(navigator as Navigator & { connection?: { saveData?: boolean } })
			.connection?.saveData
	const [live, setLive] = useState(false)

	useEffect(() => {
		const iframe = iframeRef.current
		if (!wanted || !iframe) return
		let embed: { destroy: () => void } | null = null
		let cancelled = false
		import('@vctrl/embed')
			.then(({ VectrealEmbed }) => {
				if (cancelled) return
				const connection = new VectrealEmbed(iframe, { readyTimeout: 60_000 })
				embed = connection
				return connection.ready().then(() => {
					if (!cancelled) setLive(true)
				})
			})
			// No SDK chunk or no viewer, no harm: the poster stays.
			.catch(() => {})
		return () => {
			cancelled = true
			embed?.destroy()
		}
	}, [wanted])

	return (
		<div
			ref={frameRef}
			className="ds-sunken relative aspect-16/10 w-full min-w-0 overflow-hidden rounded-2xl lg:aspect-4/3"
		>
			{scene.posterUrl ? (
				<img
					src={scene.posterUrl}
					alt=""
					fetchPriority="high"
					className={cn(
						'absolute inset-0 h-full w-full object-contain transition-opacity duration-500',
						live && 'opacity-0'
					)}
				/>
			) : null}
			{wanted ? (
				<iframe
					ref={iframeRef}
					src={scene.embedPath}
					title={scene.title ?? label}
					allow="fullscreen; xr-spatial-tracking"
					className={cn(
						'absolute inset-0 h-full w-full border-0 opacity-0 transition-opacity duration-500 pointer-coarse:pointer-events-none',
						live && 'opacity-100'
					)}
				/>
			) : null}
		</div>
	)
}
