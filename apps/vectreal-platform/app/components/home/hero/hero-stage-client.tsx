import { useEffect } from 'react'
import { TextureLoader, type Texture } from 'three'

import { HERO_SHADOW_URL } from './hero-assets'
import { fallBackToStill } from './hero-store'
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
}

interface Props {
	store: HeroStore
	elements: HeroStageElements
}

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
 * frame so uneven chunks do not step the counter. Resolves
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
		const { stage, frame } = elements

		const engine = createStageEngine(
			{
				stage,
				frame,
				copy: elements.copy,
				canvas: elements.canvas
			},
			{ reducedMotion, posterMode: baking, floor: true }
		)

		/**
		 * The still stands from the first paint. The live stage draws the same
		 * frame, the still steps aside in that task, so the swap shows nothing,
		 * and the stage turns the object into place, handed to the reader.
		 */
		async function takeOver(
			buffer: ArrayBuffer,
			show: Parameters<typeof engine.show>[1]
		) {
			await engine.show(buffer, show)
			if (abort.signal.aborted) return
			engine.settle()
			stage.setAttribute('data-phase', 'live')
			stage.setAttribute('data-turnable', '')
			store.set({ status: 'live', busy: false, view: 'live' })
			markHeroSettled()
		}

		async function run() {
			const shadow: Promise<Texture | null> = baking
				? Promise.resolve(null)
				: new TextureLoader().loadAsync(HERO_SHADOW_URL).catch(() => null)
			const buffer = await fetchWithProgress(
				HERO_MODEL.url,
				abort.signal,
				(shown, total) => {
					// As a fraction of the file's own size: a compressed response reports its compressed length.
					store.set({ shownBytes: (shown / total) * HERO_MODEL.bytes })
				},
				reducedMotion
			)
			if (abort.signal.aborted) return

			if (baking) {
				await engine.show(buffer, { poster: true })
				Object.assign(window, {
					__heroBake: {
						shadow: engine.bakedShadowPng,
						poster: engine.posterPng,
						object: engine.objectPng,
						still: engine.stillPng
					}
				})
				return
			}
			await takeOver(buffer, { bakedShadow: await shadow, poster: true })
		}

		run().catch((error: unknown) => {
			if (abort.signal.aborted) return
			// The still and the readout stand; the stage steps back to them.
			console.error('Hero stage failed', error)
			stage.setAttribute('data-phase', 'still')
			fallBackToStill(store)
			// Done with the GPU: the floor stops drifting under the still. Unmount's dispose is then a no-op.
			engine.dispose()
		})

		return () => {
			abort.abort()
			engine.dispose()
		}
	}, [store, elements])

	return null
}
