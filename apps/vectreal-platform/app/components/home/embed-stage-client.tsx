import { useEffect, useRef, type RefObject } from 'react'
import { TextureLoader } from 'three'

import { HERO_SHADOW_URL } from './hero/hero-assets'
import { createStageEngine, type StageEngine } from './hero/stage-engine'
import { HERO_MODEL } from '../../lib/samples/sample-models'

import type { FrameRect } from './product-stage'

/**
 * The hero's camera, live, in the product window.
 *
 * The hero's own stage engine, so this costs no code the page has not already
 * loaded, and the hero's file, which the browser already holds. It shows the
 * object the way a product page would: no drawing and no sweep, so it takes the
 * engine's reduced-motion path, which goes straight to the turned object, and
 * no dissolve at the stage's edges, since it sits inside a page, not on the
 * sheet.
 *
 * The canvas fills the window; the frame box it aims at is the caller's, and
 * glides between places. While it moves the camera is refitted every frame, so
 * the object travels with it rather than jumping when it lands.
 *
 * The engine renders only when something changes, so a stage nobody is turning
 * costs nothing while it waits. A file that will not load leaves the drawing
 * under it in place.
 */
export default function EmbedStageClient({
	frameRef,
	place,
	onLive
}: {
	/** The box the camera is fitted into. */
	frameRef: RefObject<HTMLDivElement | null>
	/** Where the frame is headed: a change starts the glide. */
	place: FrameRect
	onLive: () => void
}) {
	const stageRef = useRef<HTMLDivElement>(null)
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const engineRef = useRef<StageEngine | null>(null)
	// Read once: the effect below runs once, and a changed callback must not restart the stage.
	const onLiveRef = useRef(onLive)

	useEffect(() => {
		const stage = stageRef.current
		const frame = frameRef.current
		const canvas = canvasRef.current
		if (!stage || !frame || !canvas) return
		const engine = createStageEngine(
			{ stage, frame, canvas },
			{ reducedMotion: true, edgeFade: false }
		)
		engineRef.current = engine
		const abort = new AbortController()

		async function run() {
			const [buffer, bakedShadow] = await Promise.all([
				fetch(HERO_MODEL.url, { signal: abort.signal }).then((response) => {
					if (!response.ok)
						throw new Error(`Model fetch failed: ${response.status}`)
					return response.arrayBuffer()
				}),
				new TextureLoader().loadAsync(HERO_SHADOW_URL).catch(() => null)
			])
			if (abort.signal.aborted) return
			await engine.show(buffer, { bakedShadow })
			if (abort.signal.aborted) return
			await engine.reveal()
			if (!abort.signal.aborted) onLiveRef.current()
		}
		run().catch(() => {})

		return () => {
			abort.abort()
			engineRef.current = null
			engine.dispose()
		}
	}, [frameRef])

	// Follows the frame's transition to its end; with none running, as under reduced motion, it fits once.
	useEffect(() => {
		const frame = frameRef.current
		const engine = engineRef.current
		if (!frame || !engine) return
		let raf = 0
		const follow = () => {
			engine.fit()
			if (frame.getAnimations().length) raf = requestAnimationFrame(follow)
		}
		follow()
		return () => cancelAnimationFrame(raf)
	}, [frameRef, place])

	return (
		<div ref={stageRef} className="absolute inset-0">
			<canvas ref={canvasRef} className="block size-full" />
		</div>
	)
}
