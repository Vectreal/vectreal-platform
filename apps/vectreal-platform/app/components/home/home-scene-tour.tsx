import { cn } from '@shared/utils'
import { useEffect, useRef, useState } from 'react'

import { prefersReducedMotion } from '../../lib/motion/motion-tokens'

import type { PublishedEmbedScene } from '../../lib/domain/embed/published-embed-scene.server'
import type { SetTransitionOptions, VectrealEmbed } from '@vctrl/embed'

/** Where the tour runs: a wide screen. A phone keeps the band's steps as they are until the tour is tested on a real device. */
const TOUR_MEDIA = '(min-width: 64rem)'

/** The camera moves between stations the way the Shopify scene tour moves it. */
const TOUR_TRANSITION: SetTransitionOptions = {
	type: 'object_avoidance',
	duration: 2000,
	easing: 'ease_out'
}

/** How long the scene may take to say it is ready before the band keeps its steps. */
const READY_TIMEOUT_MS = 60_000

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/**
 * The scene the home page tours, asked for once the page is running, and only
 * where the tour would run. Null while none is configured, on a phone, under
 * reduced motion, or until the answer arrives: the band then shows its steps
 * as they are, which is also what the prerendered page holds.
 */
export function useHomeTour(): PublishedEmbedScene | null {
	const [scene, setScene] = useState<PublishedEmbedScene | null>(null)
	useEffect(() => {
		if (prefersReducedMotion() || !window.matchMedia(TOUR_MEDIA).matches) return
		const abort = new AbortController()
		fetch('/api/home-tour', { signal: abort.signal })
			.then((response) => (response.ok ? response.json() : null))
			.then((body: { success: boolean; data?: PublishedEmbedScene } | null) => {
				if (body?.success && body.data) setScene(body.data)
			})
			// No tour is no harm: the band stands as it is.
			.catch(() => {})
		return () => abort.abort()
	}, [])
	return scene
}

/**
 * A published scene toured by scrolling, the home page's port of the Shopify
 * scene tour (`examples/shopify/vectreal-scene-tour.liquid`): a runway as tall
 * as the stations, a stage that stays in view while it passes, and the scene's
 * saved cameras, in order, as the stations. The page's scroll is the one
 * control: the scene takes no drag, and its camera moves station to station.
 *
 * The scene loads through its own embed once the runway nears the screen, so
 * no viewer code is in this page's bundle. Its poster stands until the scene
 * is ready. A scene with fewer cameras than stations, or one that never
 * answers, calls `onUnavailable` and the band keeps its steps.
 */
export function HomeSceneTour({
	scene,
	stations,
	label,
	onStation,
	onUnavailable
}: {
	scene: PublishedEmbedScene
	stations: number
	/** Names the scene for a screen reader when it has no name of its own. */
	label: string
	/** The station the scroll has reached, from 0. */
	onStation: (station: number) => void
	onUnavailable: () => void
}) {
	const runwayRef = useRef<HTMLDivElement>(null)
	const stageRef = useRef<HTMLDivElement>(null)
	const iframeRef = useRef<HTMLIFrameElement>(null)
	const [wanted, setWanted] = useState(false)
	const [live, setLive] = useState(false)
	// Read once: the effects below run once, and a changed callback must not restart them.
	const callbacks = useRef({ onStation, onUnavailable })
	callbacks.current = { onStation, onUnavailable }

	// The embed loads only once the runway is near the screen.
	useEffect(() => {
		const runway = runwayRef.current
		if (!runway) return
		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) return
				observer.disconnect()
				setWanted(true)
			},
			{ rootMargin: '50% 0px' }
		)
		observer.observe(runway)
		return () => observer.disconnect()
	}, [])

	useEffect(() => {
		const runway = runwayRef.current
		const stage = stageRef.current
		const iframe = iframeRef.current
		if (!wanted || !runway || !stage || !iframe) return
		let embed: VectrealEmbed | null = null
		let cameras: string[] = []
		let station = -1
		let frame = 0
		let cancelled = false

		// Where the stage is pinned, read once: the runway's travel is the scroll the stations share.
		const pinnedTop = parseFloat(getComputedStyle(stage).top) || 0
		const follow = () => {
			frame = 0
			const travel = runway.offsetHeight - stage.offsetHeight
			const top = runway.getBoundingClientRect().top - pinnedTop
			const progress = travel > 0 ? clamp01(-top / travel) : 0
			const next = Math.min(stations - 1, Math.floor(progress * stations))
			if (next === station) return
			station = next
			callbacks.current.onStation(next)
			if (embed && cameras[next]) embed.activateCamera(cameras[next])
		}
		const onScroll = () => {
			frame ||= requestAnimationFrame(follow)
		}

		iframe.src = scene.embedPath
		import('@vctrl/embed')
			.then(({ VectrealEmbed }) => {
				if (cancelled) return
				const connection = new VectrealEmbed(iframe, {
					readyTimeout: READY_TIMEOUT_MS
				})
				embed = connection
				return connection.ready().then((info) => {
					if (cancelled) return
					if (info.cameras.length < stations) {
						callbacks.current.onUnavailable()
						return
					}
					cameras = info.cameras.slice(0, stations).map((camera) => camera.id)
					connection.setZoomEnabled(false)
					connection.setControlsEnabled(false)
					connection.setTransition(TOUR_TRANSITION)
					// The station the reader already scrolled to, without waiting for the next scroll.
					connection.activateCamera(cameras[Math.max(station, 0)])
					setLive(true)
				})
			})
			.catch(() => {
				if (!cancelled) callbacks.current.onUnavailable()
			})

		window.addEventListener('scroll', onScroll, { passive: true })
		follow()
		return () => {
			cancelled = true
			window.removeEventListener('scroll', onScroll)
			cancelAnimationFrame(frame)
			embed?.destroy()
		}
	}, [wanted, scene.embedPath, stations])

	return (
		// One station a screen's worth of scroll apart, plus the stage the last one stands on.
		<div
			ref={runwayRef}
			style={{ height: `calc(${stations} * 60svh + 70svh)` }}
		>
			<div
				ref={stageRef}
				className="top-below-nav ds-raised sticky aspect-4/3 overflow-hidden rounded-2xl"
			>
				{scene.posterUrl && (
					<img
						src={scene.posterUrl}
						alt=""
						loading="lazy"
						decoding="async"
						className={cn(
							'absolute inset-0 size-full object-cover transition-opacity duration-(--duration-base)',
							live && 'opacity-0'
						)}
					/>
				)}
				<iframe
					ref={iframeRef}
					title={scene.title ?? label}
					// Toured, not handled: a drag would fight the scroll that moves it.
					tabIndex={-1}
					className={cn(
						'pointer-events-none absolute inset-0 size-full border-0 opacity-0 transition-opacity duration-(--duration-base)',
						live && 'opacity-100'
					)}
				/>
			</div>
		</div>
	)
}
