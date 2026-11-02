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
	failuresToReport,
	failWith,
	passFailure,
	StudioFinishError,
	studioFinishFailure
} from '../../../../../lib/domain/scene/client/studio-finish-reasons'
import { STUDIO_FINISH_FILENAME } from '../../../../../lib/domain/scene/scene-asset-roles'
import {
	bakesKey,
	publishBakes
} from '../../../../../lib/domain/scene/studio-finish'
import { useErrorReport } from '../../../../../lib/observability/use-error-report'
import {
	bakePreviewAtom,
	hasUnsavedChangesAtom,
	type BakePreview
} from '../../../../../lib/stores/publisher-config-store'
import {
	documentOptimizationsAtom,
	optimizationRuntimeAtom
} from '../../../../../lib/stores/scene-optimization-store'
import { lightingAtom } from '../../../../../lib/stores/scene-settings-store'
import { disposeModel } from '../../../optimization/use-hold-to-compare'
import { useCompressesTexturesForGpu } from '../../../optimization/use-publish-size-projection'

import type { StudioFinishToSave } from '../../../../../lib/domain/scene/studio-finish'
import type { SavedFinishRef } from '../../../../../types/api'
import type {
	BakePassOutcome,
	PublishExportOutcome
} from '../../../../../workers/publish-export.worker.types'
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

	// A finish that fails leaves the publisher working, so nothing else would
	// report it. Keyed on the failure and reports, which survive showing and
	// hiding the preview, so one failure is reported once.
	const failure = current?.failure
	const reports = current?.reports
	const reportable = useMemo(() => {
		const [first] = failuresToReport({ failure, reports })
		return first && new Error(`Studio finish ${first.reason}: ${first.detail}`)
	}, [failure, reports])
	useErrorReport(reportable, 'client-fallback')

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
export const bakedCount = (report: BakePassOutcome | undefined) =>
	report && 'baked' in report ? report.baked.length : 0

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
  Throws the first bake's reason when every bake failed, since then it has
  nothing to show; publish ships whichever bake worked.
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
	const failure = passFailure(outcomes[0])
	if (failure && outcomes.every((report) => 'failed' in report)) {
		throw new StudioFinishError(failure)
	}
	const { scene } = await loader
		.loadToThreeJS(
			new File([outcome.buffer], 'baked.glb', { type: 'model/gltf-binary' })
		)
		.catch(failWith('unprepared'))
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
 * Restores the studio finish saved with the open scene as the preview, once
 * the document is loaded and the saved lighting has hydrated: until then the
 * key on screen describes the defaults, and the restored preview would read
 * as stale at once. Once per finish; a finish the author has moved past is
 * not brought back. It has no export stats, so publish exports afresh, and a
 * save keeps the stored finish rather than sending it again.
 */
export function useRestoreSavedFinish(saved: SavedFinishRef | null) {
	const [preview, setPreview] = useAtom(bakePreviewAtom)
	const { optimizer } = useModelContext(true)
	const { passRevision, savedPassRevision, isPending } = useAtomValue(
		optimizationRuntimeAtom
	)
	const hasUnsavedChanges = useAtomValue(hasUnsavedChangesAtom)
	const lighting = useAtomValue(lightingAtom)
	const { key } = usePublishExport()
	const loader = useMemo(() => new ModelLoader(), [])
	const attemptedRef = useRef(false)
	const document = optimizer?._getDocument?.()
	// The scene on screen is still the one the finish was saved for: no pass,
	// codec or lighting change since it opened.
	const asSaved =
		Boolean(saved) &&
		bakesKey(lighting) === saved?.bakes &&
		passRevision === savedPassRevision &&
		!hasUnsavedChanges

	useEffect(() => {
		if (!saved || !document || isPending || preview || !asSaved) return
		// Once, for the scene as it opened. A later save's finish is the
		// preview already on screen, and one left behind stays behind.
		if (attemptedRef.current) return
		attemptedRef.current = true
		const source = { document, passRevision, bakes: key }
		void (async () => {
			try {
				const response = await fetch(saved.url)
				if (!response.ok) return
				const { scene } = await loader.loadToThreeJS(
					new File([await response.arrayBuffer()], STUDIO_FINISH_FILENAME, {
						type: 'model/gltf-binary'
					})
				)
				setPreview((current) => {
					// A preview the author started meanwhile is theirs.
					if (current) {
						disposeModel(scene)
						return current
					}
					return {
						status: 'ready',
						source,
						shown: true,
						model: scene,
						reports: saved.reports,
						restored: true
					}
				})
			} catch {
				// The scene opens without its finish, as it did before one was saved.
			}
		})()
	}, [
		saved,
		document,
		isPending,
		preview,
		asSaved,
		passRevision,
		key,
		loader,
		setPreview
	])
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

const anyBakeFailed = (outcome: PublishExportOutcome) =>
	[outcome.occlusion, outcome.lights].some(
		(report) => report !== undefined && 'failed' in report
	)

/**
 * A current preview's file, when every bake in it worked: what publish ships
 * as it is. A failed bake may well work on a second try, so that one is
 * baked again instead.
 */
export const reusableFinish = (preview: BakePreview | null) =>
	preview?.status === 'ready' &&
	preview.outcome &&
	!anyBakeFailed(preview.outcome)
		? preview.outcome
		: undefined

/**
 * What a save sends of a current preview: its file and reports, when it is
 * reusable and drew anything. Nothing otherwise, which leaves the stored
 * finish as it is: the server shows that one only while it still matches
 * the scene, so a stale one is never shown and the next finish replaces it.
 */
export function studioFinishToSave(
	preview: BakePreview | null
): StudioFinishToSave | undefined {
	const outcome = reusableFinish(preview)
	if (!outcome || !bakedAnything(preview)) return undefined
	return {
		bytes: outcome.buffer,
		reports: { occlusion: outcome.occlusion, lights: outcome.lights }
	}
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
			const { data } = await exporter
				.exportDocumentGLB(document)
				.catch(failWith('unprepared'))
			const outcome = await runPublishExportInWorker(
				{ glb: data, ...publishExport.request },
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
			const failure = studioFinishFailure(error)
			console.warn('Studio finish preview failed:', failure)
			settle({ status: 'failed', source, shown: true, failure })
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
