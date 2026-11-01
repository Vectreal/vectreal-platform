import { ModelExporter } from '@vctrl/core/model-exporter'
import { ModelLoader } from '@vctrl/core/model-loader'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtom, useAtomValue } from 'jotai/react'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import {
	resolvePublishGeometryOptions,
	runPublishExportInWorker
} from '../../../../../lib/domain/scene/client/publish-export'
import {
	bakesKey,
	publishBakes
} from '../../../../../lib/domain/scene/studio-finish'
import {
	bakePreviewAtom,
	type BakePreview
} from '../../../../../lib/stores/publisher-config-store'
import {
	documentOptimizationsAtom,
	optimizationRuntimeAtom
} from '../../../../../lib/stores/scene-optimization-store'
import { lightingAtom } from '../../../../../lib/stores/scene-settings-store'
import { disposeModel } from '../../../optimization/use-hold-to-compare'
import { useCompressesTexturesForGpu } from '../../../optimization/use-publish-size-projection'

import type { PublishExportOutcome } from '../../../../../workers/publish-export.worker.types'
import type { Object3D } from 'three'

/**
 * What publishing would export now, as the request and as a key: the bakes,
 * down to the lights a light map holds, and the codecs it encodes with. The
 * preview runs this exact export, so a preview with the current key is the
 * file publishing would ship, and publish uploads it as it is.
 */
export function usePublishExport() {
	const lighting = useAtomValue(lightingAtom)
	// The settings the document was derived from, as publish reads them.
	const optimizations = useAtomValue(documentOptimizationsAtom)
	const { dracoReport } = useAtomValue(optimizationRuntimeAtom)
	const ktx2 = useCompressesTexturesForGpu()
	return useMemo(() => {
		const bakes = publishBakes(lighting)
		const geometry = resolvePublishGeometryOptions(optimizations, dracoReport)
		return {
			request: { ...geometry, ktx2, ...bakes },
			key: JSON.stringify({ bakes: bakesKey(lighting), ...geometry, ktx2 }),
			bakesAnything: bakes.occlusion || Boolean(bakes.lights)
		}
	}, [lighting, optimizations, dracoReport, ktx2])
}

/**
 * The preview, while it still belongs to the document on screen and to what
 * publishing would bake. A new model, optimization pass or bake leaves it
 * describing something else, so it reads as no preview at all.
 */
export function useCurrentPreview(): BakePreview | null {
	const preview = useAtomValue(bakePreviewAtom)
	const { optimizer } = useModelContext(true)
	const { passRevision } = useAtomValue(optimizationRuntimeAtom)
	const { key } = usePublishExport()
	const document = optimizer?._getDocument?.()
	return preview &&
		preview.source.document === document &&
		preview.source.passRevision === passRevision &&
		preview.source.bakes === key
		? preview
		: null
}

/*
  Owns the preview's lifetime from the publisher route, which outlives the
  panel: a preview gone stale is cleared, and a baked model is freed only once
  the viewer has stopped drawing it, after the commit that replaced it.
*/
function usePreviewLifetime(current: BakePreview | null) {
	const [preview, setPreview] = useAtom(bakePreviewAtom)
	const drawnRef = useRef<Object3D | undefined>(undefined)

	useEffect(() => {
		if (preview && !current) setPreview(null)
	}, [current, preview, setPreview])

	useEffect(() => {
		const previous = drawnRef.current
		drawnRef.current = preview?.model
		if (previous && previous !== preview?.model) disposeModel(previous)
	}, [preview?.model])

	useEffect(
		() => () => {
			if (drawnRef.current) disposeModel(drawnRef.current)
			drawnRef.current = undefined
			setPreview(null)
		},
		[setPreview]
	)
}

/** How many materials a bake reached; none when it failed. */
export const bakedCount = (
	report: { baked: string[] } | { failed: string } | undefined
) => (report && 'baked' in report ? report.baked.length : 0)

/** What a preview says while it draws: which step, and how far it has come. */
export const drawingLabel = (progress: BakePreview['progress']) => {
	if (!progress) return 'Drawing the finish'
	if (progress.stage === 'textures') {
		return `Compressing textures (${progress.texturesDone} of ${progress.texturesTotal})`
	}
	return `Drawing the ${progress.stage === 'occlusion' ? 'depth' : 'studio lights'} (${Math.round(progress.fraction * 100)}%)`
}

/*
  A finished export as a preview to show: the bakes it reports, its file
  loaded for the viewer, and the file itself, which publish ships unchanged.
  Throws when every bake failed, since then it has nothing to show; publish
  ships whichever bake worked.
*/
async function finishedPreview(
	loader: ModelLoader,
	source: BakePreview['source'],
	outcome: PublishExportOutcome,
	durationMs?: number
): Promise<BakePreview> {
	const reports = { occlusion: outcome.occlusion, lights: outcome.lights }
	const outcomes = [reports.occlusion, reports.lights].filter(
		(report) => report !== undefined
	)
	const failure = outcomes.find((report) => 'failed' in report)
	if (failure && 'failed' in failure && outcomes.every((r) => 'failed' in r)) {
		throw new Error(failure.failed)
	}
	const { scene } = await loader.loadToThreeJS(
		new File([outcome.buffer], 'baked.glb', { type: 'model/gltf-binary' })
	)
	return {
		status: 'ready',
		source,
		shown: true,
		model: scene,
		reports,
		outcome,
		durationMs
	}
}

/**
 * Shows what a publish just exported as the preview, so the publisher shows
 * the finish it shipped. For an export run with the document and request on
 * screen; a failure to show it leaves the publish as it was.
 */
export function useShowPublishedFinish() {
	const [, setPreview] = useAtom(bakePreviewAtom)
	const loader = useMemo(() => new ModelLoader(), [])
	return useCallback(
		async (source: BakePreview['source'], outcome: PublishExportOutcome) => {
			try {
				const next = await finishedPreview(loader, source, outcome)
				setPreview((current) => {
					// A preview asked for since, of other lights or codecs, is the
					// author's newer request and stays.
					if (current && current.source.bakes !== source.bakes) {
						if (next.model) disposeModel(next.model)
						return current
					}
					// One of the same export still drawing is dropped when it lands.
					return { ...next, shown: current?.shown ?? true }
				})
			} catch {
				// Every bake failed; the publish already warned about it.
			}
		},
		[loader, setPreview]
	)
}

/** Whether a finished preview changed anything a viewer would draw. */
export const bakedAnything = (preview: BakePreview | null) =>
	bakedCount(preview?.reports?.occlusion) +
		bakedCount(preview?.reports?.lights) >
	0

/** What the viewer is doing with the model the bake would stand in for. */
export interface ShownBakeContext {
	isLightingOpen: boolean
	/** Whether the viewer can pose the model: it has clips the runtime may play. */
	canAnimate: boolean
	/** Whether a clip is playing right now. */
	isAnimating: boolean
}

/**
 * The baked model the viewer shows in place of the model, while the author
 * shows it. Call it once, from the publisher route: it also owns the
 * preview's lifetime.
 *
 * The viewer never animates the copy it draws in place of the model, so the
 * copy only matches the model while the model rests in its bind pose. A model
 * nothing can pose keeps the copy in every tool. One the runtime can pose,
 * by playing, pausing mid-clip, scrubbing or holding a clip's closing pose,
 * keeps it only inside the Lighting tool, where the author asked to look at
 * the bake, and never while a clip plays.
 */
export function useShownBake({
	isLightingOpen,
	canAnimate,
	isAnimating
}: ShownBakeContext): Object3D | undefined {
	const preview = useCurrentPreview()
	usePreviewLifetime(preview)
	const matchesModel = !canAnimate || (isLightingOpen && !isAnimating)
	return matchesModel &&
		preview?.status === 'ready' &&
		// A bake that changed nothing has no switch to turn it off, and its copy
		// would only freeze an animated model in its rest pose.
		bakedAnything(preview) &&
		preview.shown
		? preview.model
		: undefined
}

/**
 * Bakes what publishing would bake, off the main thread: the publish worker
 * runs with only the bakes on, and its GLB is shown in place of the model.
 * One preview at a time; baking again replaces it.
 */
export function useBakePreview() {
	const [, setPreview] = useAtom(bakePreviewAtom)
	const preview = useCurrentPreview()
	const { optimizer, file } = useModelContext(true)
	const { passRevision, isPending } = useAtomValue(optimizationRuntimeAtom)
	const publishExport = usePublishExport()
	const exporter = useMemo(() => new ModelExporter(), [])
	const loader = useMemo(() => new ModelLoader(), [])
	const document = optimizer?._getDocument?.()

	// A pass rewrites the document in place, so a bake mid-pass would capture
	// a model that is neither the one before nor the one after.
	const canBake = Boolean(document) && !isPending && publishExport.bakesAnything

	const bake = useCallback(async () => {
		if (!document || isPending || !publishExport.bakesAnything) return
		const source = { document, passRevision, bakes: publishExport.key }
		const started = performance.now()
		// The model it replaces is freed once the viewer lets go of it.
		setPreview({ status: 'baking', source, shown: true })
		// Written only while this bake is still the latest one; a result that
		// lost was never drawn, so it is freed at once.
		const settle = (next: BakePreview) =>
			setPreview((current) => {
				if (current?.source !== source) {
					if (next.model) disposeModel(next.model)
					return current
				}
				return next
			})
		// The worker reports before it finishes, so this lands only while baking.
		const report = (progress: NonNullable<BakePreview['progress']>) =>
			setPreview((current) =>
				current?.source === source ? { ...current, progress } : current
			)

		try {
			const { data } = await exporter.exportDocumentGLB(document)
			const outcome = await runPublishExportInWorker(
				{
					buffer: data.slice().buffer as ArrayBuffer,
					...publishExport.request
				},
				report
			)
			settle(
				await finishedPreview(
					loader,
					source,
					outcome,
					performance.now() - started
				)
			)
		} catch (error) {
			settle({
				status: 'failed',
				source,
				shown: true,
				error: error instanceof Error ? error.message : String(error)
			})
		}
	}, [
		publishExport,
		document,
		exporter,
		isPending,
		loader,
		passRevision,
		setPreview
	])

	const setShown = useCallback(
		(shown: boolean) =>
			setPreview((current) => (current ? { ...current, shown } : current)),
		[setPreview]
	)

	return {
		preview,
		canBake,
		/** Whether the lighting asks for any bake at all. */
		bakesAnything: publishExport.bakesAnything,
		isOptimizing: isPending,
		// The viewer draws the preview unanimated, in its rest pose.
		isAnimated: Boolean(file?.animations?.length),
		bake,
		setShown
	}
}
