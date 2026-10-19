import { useEffect } from 'react'
import { TextureLoader, type Texture } from 'three'

import { HERO_SHADOW_URL } from './hero-assets'
import { fallBackToPoster } from './hero-store'
import { prefersReducedMotion } from '../../../lib/motion/motion-tokens'
import { HERO_MODEL } from '../../../lib/samples/sample-models'
import { markHeroSettled } from '../stage/hero-settled'
import { createStageEngine } from '../stage/stage-engine'

import type { HeroStore } from './hero-store'

/** The server-rendered sheet's nodes the stage draws into and measures. */
export interface HeroStageElements {
	copy: HTMLElement
	stage: HTMLElement
	frame: HTMLElement
	canvas: HTMLCanvasElement
	dims: SVGSVGElement
	scale: HTMLElement
}

interface Props {
	store: HeroStore
	elements: HeroStageElements
}

/** How long the drawing stands as a drawing before the sweep: long enough to read as one, short enough not to read as a wait. */
const DRAWN_HOLD_MS = 600

/*
  Bake mode, for `scripts/bake-home-hero.ts` against the dev server only: the
  stage draws the elevation whole and unfaded, bakes the shadow live instead of
  loading it, and hands both back through `window`.
*/
const bakeMode = () =>
	import.meta.env.DEV &&
	new URLSearchParams(window.location.search).has('hero-bake')

/**
 * Streams a file with its progress, gliding toward the latest byte count each
 * frame so uneven chunks do not step the counter or the plot front. Resolves
 * once the glide has landed, so what follows starts from a finished figure.
 */
async function fetchWithProgress(
	url: string,
	signal: AbortSignal,
	onShown: (bytes: number, total: number) => void,
	reducedMotion: boolean
): Promise<ArrayBuffer> {
	const response = await fetch(url, { signal })
	if (!response.ok || !response.body)
		throw new Error(`Model fetch failed: ${response.status}`)
	const total =
		Number(response.headers.get('content-length')) || HERO_MODEL.bytes
	const reader = response.body.getReader()
	const chunks: Uint8Array[] = []
	let got = 0
	let shown = 0
	let landed = () => {}
	const settled = new Promise<void>((resolve) => (landed = resolve))
	const glide = () => {
		if (signal.aborted) return
		shown += (got - shown) * (reducedMotion ? 1 : 0.18)
		if (got >= total && total - shown < total * 0.002) shown = total
		onShown(shown, total)
		if (shown < total) requestAnimationFrame(glide)
		else landed()
	}
	requestAnimationFrame(glide)
	for (;;) {
		const { done, value } = await reader.read()
		if (done) break
		chunks.push(value)
		got += value.length
	}
	await settled
	const buffer = new Uint8Array(got)
	let offset = 0
	for (const chunk of chunks) {
		buffer.set(chunk, offset)
		offset += chunk.length
	}
	return buffer.buffer
}

export default function HeroStageClient({ store, elements }: Props) {
	useEffect(() => {
		const reducedMotion = prefersReducedMotion()
		const baking = bakeMode()
		const abort = new AbortController()
		const timers: number[] = []
		const { stage, frame } = elements

		const engine = createStageEngine(
			{
				stage,
				frame,
				copy: elements.copy,
				canvas: elements.canvas,
				dims: elements.dims,
				scale: elements.scale
			},
			{ reducedMotion, posterMode: baking, floor: true }
		)

		const setPhase = (phase: 'poster' | 'drawn' | 'live') =>
			stage.setAttribute('data-phase', phase)
		const hold = (ms: number) =>
			new Promise<void>((resolve) =>
				timers.push(window.setTimeout(resolve, ms))
			)

		/**
		 * The model on the stage: shown as its elevation, held long enough to read
		 * as a drawing, swept into an object, then turned and handed over.
		 */
		async function drawThenReveal(
			buffer: ArrayBuffer,
			show: Parameters<typeof engine.show>[1]
		) {
			await engine.show(buffer, show)
			if (abort.signal.aborted) return
			setPhase('drawn')
			store.set({ status: 'drawn' })
			await hold(reducedMotion ? 0 : DRAWN_HOLD_MS)
			if (abort.signal.aborted) return
			store.set({ status: 'rendering' })
			await engine.reveal()
			if (abort.signal.aborted) return
			setPhase('live')
			stage.setAttribute('data-turnable', '')
			store.set({ status: 'live', busy: false, view: 'live' })
			markHeroSettled()
		}

		async function run() {
			stage.setAttribute('data-receiving', '')
			const shadow: Promise<Texture | null> = baking
				? Promise.resolve(null)
				: new TextureLoader().loadAsync(HERO_SHADOW_URL).catch(() => null)
			const buffer = await fetchWithProgress(
				HERO_MODEL.url,
				abort.signal,
				(shown, total) => {
					// As a fraction of the file's own size: a compressed response reports its compressed length.
					frame.style.setProperty('--plot', (shown / total).toFixed(4))
					store.set({ shownBytes: (shown / total) * HERO_MODEL.bytes })
				},
				reducedMotion
			)
			stage.removeAttribute('data-receiving')
			if (abort.signal.aborted) return

			if (baking) {
				await engine.show(buffer, { poster: true })
				Object.assign(window, {
					__heroBake: {
						shadow: engine.bakedShadowPng,
						poster: engine.posterPng,
						object: engine.objectPng
					}
				})
				return
			}
			await drawThenReveal(buffer, { bakedShadow: await shadow, poster: true })
		}

		run().catch((error: unknown) => {
			if (abort.signal.aborted) return
			// The poster and the readout still stand, and the poster is drawn from the file; the stage steps back to them.
			console.error('Hero stage failed', error)
			stage.removeAttribute('data-receiving')
			setPhase('poster')
			fallBackToPoster(store, frame)
			// Done with the GPU: the floor stops drifting under the poster. Unmount's dispose is then a no-op.
			engine.dispose()
		})

		return () => {
			abort.abort()
			for (const timer of timers) window.clearTimeout(timer)
			engine.dispose()
		}
	}, [store, elements])

	return null
}
