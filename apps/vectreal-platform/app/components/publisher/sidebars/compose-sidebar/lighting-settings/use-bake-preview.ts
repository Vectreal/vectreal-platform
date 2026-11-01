import { bakedLightsSignature } from '@vctrl/core'
import { ModelExporter } from '@vctrl/core/model-exporter'
import { ModelLoader } from '@vctrl/core/model-loader'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtom, useAtomValue } from 'jotai/react'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import {
	publishBakes,
	runPublishExportInWorker
} from '../../../../../lib/domain/scene/client/publish-export'
import {
	bakePreviewAtom,
	type BakePreview
} from '../../../../../lib/stores/publisher-config-store'
import { optimizationRuntimeAtom } from '../../../../../lib/stores/scene-optimization-store'
import { lightingAtom } from '../../../../../lib/stores/scene-settings-store'
import { disposeModel } from '../../../optimization/use-hold-to-compare'

import type { Object3D } from 'three'

/**
 * What publishing would bake now, as the request and as a key: a preview made
 * for another key shows what will not ship. A light map is keyed by the
 * lights it holds, so moving one makes the preview stale.
 */
function useRequestedBakes() {
	const lighting = useAtomValue(lightingAtom)
	return useMemo(() => {
		const request = publishBakes(lighting)
		return {
			request,
			key: JSON.stringify({
				occlusion: request.occlusion,
				lights: request.lights && bakedLightsSignature(request.lights)
			}),
			any: request.occlusion || Boolean(request.lights)
		}
	}, [lighting])
}

/**
 * The preview, while it still belongs to the document on screen and to what
 * publishing would bake. A new model, optimization pass or bake leaves it
 * describing something else, so it reads as no preview at all.
 */
function useCurrentPreview(): BakePreview | null {
	const preview = useAtomValue(bakePreviewAtom)
	const { optimizer } = useModelContext(true)
	const { passRevision } = useAtomValue(optimizationRuntimeAtom)
	const { key } = useRequestedBakes()
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

/** What a preview says while it draws: which bake, and how far it has come. */
export const drawingLabel = (progress: BakePreview['progress']) =>
	progress
		? `Drawing the ${progress.stage === 'occlusion' ? 'depth' : 'studio lights'} (${Math.round(progress.fraction * 100)}%)`
		: 'Drawing the finish'

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
	const bakes = useRequestedBakes()
	const exporter = useMemo(() => new ModelExporter(), [])
	const loader = useMemo(() => new ModelLoader(), [])
	const document = optimizer?._getDocument?.()

	// A pass rewrites the document in place, so a bake mid-pass would capture
	// a model that is neither the one before nor the one after.
	const canBake = Boolean(document) && !isPending && bakes.any

	const bake = useCallback(async () => {
		if (!document || isPending || !bakes.any) return
		const source = { document, passRevision, bakes: bakes.key }
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
			const result = await runPublishExportInWorker(
				{
					buffer: data.slice().buffer as ArrayBuffer,
					dracoWorthApplying: true,
					ktx2: false,
					...bakes.request
				},
				(progress) => {
					// Textures are not encoded here, so only the bakes report.
					if (progress.stage !== 'textures') report(progress)
				}
			)
			const reports = { occlusion: result.occlusion, lights: result.lights }
			// Publishing ships whichever bake worked, so the preview fails only
			// when none did.
			const outcomes = [reports.occlusion, reports.lights].filter(
				(report) => report !== undefined
			)
			const failure = outcomes.find((report) => 'failed' in report)
			if (
				failure &&
				'failed' in failure &&
				outcomes.every((r) => 'failed' in r)
			) {
				throw new Error(failure.failed)
			}
			const { scene } = await loader.loadToThreeJS(
				new File([result.buffer], 'baked.glb', { type: 'model/gltf-binary' })
			)
			settle({
				status: 'ready',
				source,
				shown: true,
				model: scene,
				reports,
				durationMs: performance.now() - started
			})
		} catch (error) {
			settle({
				status: 'failed',
				source,
				shown: true,
				error: error instanceof Error ? error.message : String(error)
			})
		}
	}, [bakes, document, exporter, isPending, loader, passRevision, setPreview])

	const setShown = useCallback(
		(shown: boolean) =>
			setPreview((current) => (current ? { ...current, shown } : current)),
		[setPreview]
	)

	return {
		preview,
		canBake,
		/** Whether the lighting asks for any bake at all. */
		bakesAnything: bakes.any,
		isOptimizing: isPending,
		// The viewer draws the preview unanimated, in its rest pose.
		isAnimated: Boolean(file?.animations?.length),
		bake,
		setShown
	}
}
