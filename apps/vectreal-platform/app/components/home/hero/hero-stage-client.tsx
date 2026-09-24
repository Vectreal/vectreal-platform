import {
	lazy,
	Suspense,
	useCallback,
	useEffect,
	useRef,
	useState,
	type MutableRefObject
} from 'react'
import { TextureLoader, type Texture } from 'three'

import { createBackdropEngine } from './backdrop-engine'
import { HERO_SHADOW_URL } from './hero-assets'
import { StageBoundary } from './stage-boundary'
import { createStageEngine } from './stage-engine'
import { readGlbContents } from '../../../lib/samples/glb-contents'
import { HERO_MODEL } from '../../../lib/samples/sample-models'

import type { OwnFileApi } from './hero-own-file'
import type { HeroState, HeroStore } from './hero-store'

// A function, not one module-level `lazy`: React caches a rejected import, so a retry after a failed chunk needs a fresh one.
const loadOwnFile = () => lazy(() => import('./hero-own-file'))

/** The server-rendered sheet's nodes the stage draws into and measures. */
export interface HeroStageElements {
	sheet: HTMLElement
	copy: HTMLElement
	stage: HTMLElement
	frame: HTMLElement
	canvas: HTMLCanvasElement
	dims: SVGSVGElement
	scale: HTMLElement
	readout: HTMLElement
	backdrop: HTMLCanvasElement
}

interface Props {
	store: HeroStore
	elements: HeroStageElements
	openFileRef: MutableRefObject<(() => void) | null>
	handOffRef: MutableRefObject<(() => Promise<void>) | null>
}

/** How long the drawing stands as a drawing before the sweep, so it reads as one. */
const DRAWN_HOLD_MS = 1800

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

export default function HeroStageClient({
	store,
	elements,
	openFileRef,
	handOffRef
}: Props) {
	/*
	  The visitor's-file machinery is a second lazy chunk, mounted on the first
	  file. `ownFile` is a promise of its api, so a drop that arrives while the
	  chunk is still loading simply waits for it.
	*/
	const [ownFileWanted, setOwnFileWanted] = useState(false)
	const [HeroOwnFile, setHeroOwnFile] = useState(loadOwnFile)
	const ownFile = useRef<{
		api: Promise<OwnFileApi>
		ready: (api: OwnFileApi) => void
		fail: () => void
	} | null>(null)
	const ownFileApi = useCallback(() => {
		if (!ownFile.current) {
			let ready: (api: OwnFileApi) => void = () => {}
			let fail = () => {}
			const api = new Promise<OwnFileApi>((resolve, reject) => {
				ready = resolve
				fail = () => {
					ownFile.current = null
					reject(new Error('The file chunk failed'))
				}
			})
			ownFile.current = { api, ready, fail }
			setOwnFileWanted(true)
		}
		return ownFile.current.api
	}, [])
	const onOwnFileReady = useCallback(
		(api: OwnFileApi) => ownFile.current?.ready(api),
		[]
	)
	const onOwnFileFailed = useCallback(() => {
		ownFile.current?.fail()
		setOwnFileWanted(false)
		setHeroOwnFile(loadOwnFile)
	}, [])

	useEffect(() => {
		const reducedMotion = window.matchMedia(
			'(prefers-reduced-motion: reduce)'
		).matches
		const baking = bakeMode()
		const abort = new AbortController()
		const timers: number[] = []
		const { sheet, stage, frame } = elements

		const engine = createStageEngine(
			{
				stage,
				frame,
				copy: elements.copy,
				canvas: elements.canvas,
				dims: elements.dims,
				scale: elements.scale
			},
			{ reducedMotion, posterMode: baking }
		)
		const backdrop = baking
			? null
			: createBackdropEngine(
					{
						canvas: elements.backdrop,
						sheet,
						stage,
						frame,
						copy: elements.copy,
						readout: elements.readout
					},
					{ reducedMotion, azimuth: engine.azimuth }
				)
		if (backdrop) {
			engine.onFrame(backdrop.draw)
			elements.backdrop.setAttribute('data-ready', '')
		}

		const setPhase = (phase: 'poster' | 'drawn' | 'live') =>
			stage.setAttribute('data-phase', phase)
		const hold = (ms: number) =>
			new Promise<void>((resolve) =>
				timers.push(window.setTimeout(resolve, ms))
			)

		/**
		 * A model on the stage goes the same way whoever brought it: shown as its
		 * elevation, held long enough to read as a drawing, swept into an object,
		 * then turned and handed over. Resolves false when the page left first.
		 */
		async function drawThenReveal(
			buffer: ArrayBuffer,
			show: Parameters<typeof engine.show>[1],
			drawn: Partial<HeroState>,
			live: Partial<HeroState>
		) {
			await engine.show(buffer, show)
			stage.removeAttribute('data-turnable')
			if (abort.signal.aborted) return false
			setPhase('drawn')
			store.set({ status: 'drawn', ...drawn })
			await hold(reducedMotion ? 0 : DRAWN_HOLD_MS)
			if (abort.signal.aborted) return false
			store.set({ status: 'rendering' })
			await engine.reveal()
			if (abort.signal.aborted) return false
			setPhase('live')
			stage.setAttribute('data-turnable', '')
			store.set({ status: 'live', busy: false, view: 'live', ...live })
			return true
		}

		/** A visitor's file: optimized with the publisher's Balanced preset, then drawn like the sample. */
		async function take(files: File[]) {
			if (store.get().busy) return
			store.set({ status: 'optimizing', busy: true, canHandOff: false })
			try {
				const outcome = await (await ownFileApi()).prepare(files)
				if (abort.signal.aborted) return
				if (!outcome.ok) {
					store.set({ status: outcome.reason, busy: false })
					return
				}
				const { buffer, fileName, originalBytes, bytes } = outcome
				const readout = {
					fileName,
					...readGlbContents(buffer),
					originalBytes,
					bytes
				}
				await drawThenReveal(
					buffer,
					{},
					{ view: 'dropped', readout, shownBytes: bytes },
					{ canHandOff: true }
				)
			} catch (error) {
				if (abort.signal.aborted) return
				console.error('Hero stage could not take the file', error)
				store.set({ status: 'failed', busy: false })
			}
		}

		// From here the stage takes files: the secondary door opens a picker, and the whole sheet is a drop target.
		const picker = document.createElement('input')
		picker.type = 'file'
		picker.multiple = true
		picker.addEventListener('change', () => {
			const files = [...(picker.files ?? [])]
			picker.value = ''
			if (files.length) void take(files)
		})
		let depth = 0
		let before: HeroState['status'] | null = null
		const endDrag = () => {
			depth = 0
			sheet.removeAttribute('data-dragging')
			if (before) store.set({ status: before })
			before = null
		}
		/*
		  Files dragged over the sheet are always claimed, so a drop can never fall
		  through to the browser and navigate away from the page; while the stage
		  is busy they are claimed and ignored.
		*/
		const carriesFiles = (event: DragEvent) =>
			event.dataTransfer?.types.includes('Files') ?? false
		const onDragEnter = (event: DragEvent) => {
			if (!carriesFiles(event)) return
			event.preventDefault()
			if (store.get().busy) return
			if (depth++ === 0) {
				before = store.get().status
				sheet.setAttribute('data-dragging', '')
				store.set({ status: 'dragging' })
			}
		}
		const onDragOver = (event: DragEvent) => {
			if (carriesFiles(event)) event.preventDefault()
		}
		const onDragLeave = () => {
			if (depth && --depth === 0) endDrag()
		}
		const onDrop = (event: DragEvent) => {
			if (!carriesFiles(event)) return
			event.preventDefault()
			if (!depth) return
			endDrag()
			const files = [...(event.dataTransfer?.files ?? [])]
			if (files.length) void take(files)
		}
		function acceptFiles() {
			openFileRef.current = () => picker.click()
			handOffRef.current = async () => (await ownFileApi()).handOff()
			sheet.addEventListener('dragenter', onDragEnter)
			sheet.addEventListener('dragover', onDragOver)
			sheet.addEventListener('dragleave', onDragLeave)
			sheet.addEventListener('drop', onDrop)
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
						poster: engine.posterPng
					}
				})
				return
			}
			if (
				await drawThenReveal(
					buffer,
					{ bakedShadow: await shadow, poster: true },
					{},
					{}
				)
			)
				acceptFiles()
		}

		run().catch((error: unknown) => {
			if (abort.signal.aborted) return
			// The poster and the readout still stand, and the poster is drawn from the file; the stage steps back to them.
			console.error('Hero stage failed', error)
			stage.removeAttribute('data-receiving')
			setPhase('poster')
			// The poster whole, not wherever the download stopped: it is the drawing the readout now describes.
			frame.style.setProperty('--plot', '1')
			store.set({ status: 'drawn', busy: false, shownBytes: HERO_MODEL.bytes })
		})

		return () => {
			abort.abort()
			for (const timer of timers) window.clearTimeout(timer)
			openFileRef.current = null
			handOffRef.current = null
			sheet.removeEventListener('dragenter', onDragEnter)
			sheet.removeEventListener('dragover', onDragOver)
			sheet.removeEventListener('dragleave', onDragLeave)
			sheet.removeEventListener('drop', onDrop)
			endDrag()
			backdrop?.dispose()
			engine.dispose()
			elements.backdrop.removeAttribute('data-ready')
		}
	}, [store, elements, openFileRef, handOffRef, ownFileApi])

	return ownFileWanted ? (
		<StageBoundary onError={onOwnFileFailed}>
			<Suspense fallback={null}>
				<HeroOwnFile onReady={onOwnFileReady} />
			</Suspense>
		</StageBoundary>
	) : null
}
