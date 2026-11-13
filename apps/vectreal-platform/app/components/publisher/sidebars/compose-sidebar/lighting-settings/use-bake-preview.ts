import { ModelExporter } from '@vctrl/core/model-exporter'
import { ModelLoader } from '@vctrl/core/model-loader'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtom, useAtomValue } from 'jotai/react'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import { useStudioFinishPlan } from './use-studio-finish-plan'
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
	eligibleBakes,
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
 * What publishing would export now, in its two parts. The studio finish is
 * the bake alone, the model with occlusion and light maps drawn in and no
 * codec applied, keyed on what it bakes down to the lights a light map holds.
 * The publish encode then takes the finish, or the model when nothing is
 * baked, and applies the codecs the scene asks for. Keeping the codecs out of
 * the finish is what lets a codec switch, such as GPU-compressed textures,
 * leave a finish that took minutes to draw in place.
 */
export function usePublishExport() {
	const lighting = useAtomValue(lightingAtom)
	// The settings the document was derived from, as publish reads them.
	const optimizations = useAtomValue(documentOptimizationsAtom)
	const { dracoReport } = useAtomValue(optimizationRuntimeAtom)
	const ktx2 = useCompressesTexturesForGpu()
	const plan = useStudioFinishPlan()
	return useMemo(() => {
		// The key stays the lighting's: a bake with nothing to take draws the
		// same file whether it runs or not, so the plan landing leaves a
		// preview made before it current.
		const asked = publishBakes(lighting)
		const bakes = eligibleBakes(asked, plan)
		const geometry = resolvePublishGeometryOptions(optimizations, dracoReport)
		return {
			/** The bake alone: no Draco or meshopt, no KTX2. */
			finishRequest: { dracoWorthApplying: false, ktx2: false, ...bakes },
			finishKey: JSON.stringify(bakesKey(lighting)),
			/** The codecs publish encodes the finish, or the model, with. */
			request: { ...geometry, ktx2, occlusion: false, lights: false as const },
			codecsKey: JSON.stringify({ ...geometry, ktx2 }),
			bakesAnything: bakes.occlusion || Boolean(bakes.lights),
			/** Whether the lighting asks for any bake, whether or not it can run. */
			asksAnything: asked.occlusion || Boolean(asked.lights)
		}
	}, [lighting, optimizations, dracoReport, ktx2, plan])
}

/**
 * The preview, while it still belongs to the document on screen and to what
 * publishing would bake. A new model, optimization pass or bake leaves it
 * describing something else, so it reads as no preview at all. A codec
 * switch does not: publish encodes the finish as it is.
 */
export function useCurrentPreview(): BakePreview | null {
	const preview = useAtomValue(bakePreviewAtom)
	const { optimizer } = useModelContext(true)
	const { passRevision } = useAtomValue(optimizationRuntimeAtom)
	const { finishKey, codecsKey } = usePublishExport()
	const document = optimizer?._getDocument?.()
	return preview &&
		preview.source.document === document &&
		preview.source.passRevision === passRevision &&
		preview.source.bakes === finishKey &&
		(preview.codecs === undefined || preview.codecs === codecsKey)
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
	const uvLayoutFailure = current?.uvLayoutFailure
	const reportable = useMemo(() => {
		const reported = failuresToReport({ failure, reports, uvLayoutFailure })
		// One report per run, naming every fault in it.
		return reported.length > 0
			? new Error(
					`Studio finish ${reported
						.map(({ reason, detail }) => `${reason}: ${detail}`)
						.join('; ')}`
				)
			: undefined
	}, [failure, reports, uvLayoutFailure])
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
	if (progress.stage === 'uvs') return 'Preparing the model'
	if (progress.stage === 'textures') {
		return `Compressing textures (${progress.texturesDone} of ${progress.texturesTotal})`
	}
	return `Drawing the ${progress.stage === 'occlusion' ? 'depth' : 'studio lights'} (${Math.round(progress.fraction * 100)}%)`
}

/*
  A finished bake as a preview to show: the bakes it reports, its file
  loaded for the viewer, and the file itself, which publish encodes.
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
		throw new StudioFinishError(failure, reports)
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
		file: outcome.buffer,
		uvLayoutFailure: outcome.uvLayoutFailure,
		durationMs
	}
}

/** A preview that drew nothing, with why, and every bake's report it has. */
function failedPreview(
	source: BakePreview['source'],
	error: unknown
): BakePreview {
	const failure = studioFinishFailure(error)
	console.warn('Studio finish failed:', failure)
	return {
		status: 'failed',
		source,
		shown: true,
		failure,
		...(error instanceof StudioFinishError && error.reports
			? { reports: error.reports }
			: {})
	}
}

/**
 * Restores the studio finish saved with the open scene as the preview, once
 * the document is loaded and the saved lighting has hydrated: until then the
 * key on screen describes the defaults, and the restored preview would read
 * as stale at once. Once per finish; a finish the author has moved past is
 * not brought back. Publish encodes its file rather than baking again,
 * unless it was saved as a published file, and a save keeps the stored
 * finish rather than sending it again.
 */
export function useRestoreSavedFinish(saved: SavedFinishRef | null) {
	const [preview, setPreview] = useAtom(bakePreviewAtom)
	const { optimizer } = useModelContext(true)
	const { passRevision, savedPassRevision, isPending } = useAtomValue(
		optimizationRuntimeAtom
	)
	const hasUnsavedChanges = useAtomValue(hasUnsavedChangesAtom)
	const lighting = useAtomValue(lightingAtom)
	const { finishKey, codecsKey } = usePublishExport()
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
		const source = { document, passRevision, bakes: finishKey }
		void (async () => {
			try {
				const response = await fetch(saved.url)
				if (!response.ok) return
				const file = await response.arrayBuffer()
				const { scene } = await loader.loadToThreeJS(
					new File([file], STUDIO_FINISH_FILENAME, {
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
						// The server opened it under the codecs on screen now.
						...(saved.unencoded ? { file } : { codecs: codecsKey }),
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
		finishKey,
		codecsKey,
		loader,
		setPreview
	])
}

/**
 * Shows the finish a publish just baked as the preview, so the publisher
 * shows the finish it shipped and a save keeps it. For a bake run with the
 * document and request on screen; a failure to show it leaves the publish as
 * it was.
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
			} catch (error) {
				// Every bake failed. The publish already warned about it; the
				// preview says so too, as one that failed would.
				setPreview((current) =>
					current && current.source.bakes !== source.bakes
						? current
						: failedPreview(source, error)
				)
			}
		},
		[loader, setPreview]
	)
}

const anyBakeFailed = (reports: BakePreview['reports']) =>
	[reports?.occlusion, reports?.lights].some(
		(report) => report !== undefined && 'failed' in report
	)

/**
 * A current preview's file and reports, when every bake in it worked: the
 * finish publish encodes rather than baking again. A failed bake may well
 * work on a second try, so that one is baked again instead, and so is a
 * restored finish saved as a published file, which has no file to encode.
 */
export function reusableFinish(
	preview: BakePreview | null
): StudioFinishToSave | undefined {
	return preview?.status === 'ready' &&
		preview.file &&
		!anyBakeFailed(preview.reports)
		? {
				bytes: preview.file,
				reports: {
					occlusion: preview.reports?.occlusion,
					lights: preview.reports?.lights
				}
			}
		: undefined
}

/**
 * What a save sends of a current preview: its file and reports, when it is
 * reusable, drew anything and is not the stored one restored. Nothing
 * otherwise, which leaves the stored finish as it is: the server shows that
 * one only while it still matches the scene, so a stale one is never shown
 * and the next finish replaces it.
 */
export function studioFinishToSave(
	preview: BakePreview | null
): StudioFinishToSave | undefined {
	if (preview?.restored || !bakedAnything(preview)) return undefined
	return reusableFinish(preview)
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
		const source = { document, passRevision, bakes: publishExport.finishKey }
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
				{ glb: data, ...publishExport.finishRequest },
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
			settle(failedPreview(source, error))
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
		/** Whether any bake will run: asked for, and able to take a material. */
		bakesAnything: publishExport.bakesAnything,
		/** Whether the lighting asks for any bake at all. */
		asksAnything: publishExport.asksAnything,
		isOptimizing: isPending,
		// The viewer draws the preview unanimated, in its rest pose.
		isAnimated: Boolean(file?.animations?.length),
		bake,
		setShown
	}
}
