import { resolveLighting } from '@vctrl/core'
import { ModelExporter } from '@vctrl/core/model-exporter'
import { ModelLoader } from '@vctrl/core/model-loader'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtom, useAtomValue } from 'jotai/react'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import { runPublishExportInWorker } from '../../../../../lib/domain/scene/client/publish-export'
import {
	occlusionBakePreviewAtom,
	type OcclusionBakePreview
} from '../../../../../lib/stores/publisher-config-store'
import { optimizationRuntimeAtom } from '../../../../../lib/stores/scene-optimization-store'
import { lightingAtom } from '../../../../../lib/stores/scene-settings-store'
import { disposeModel } from '../../../optimization/use-hold-to-compare'

import type { Object3D } from 'three'

/**
 * The preview, while it still belongs to the document on screen. A new model
 * or optimization pass leaves it describing something else, so it reads as
 * no preview at all.
 */
function useCurrentPreview(): OcclusionBakePreview | null {
	const preview = useAtomValue(occlusionBakePreviewAtom)
	const { optimizer } = useModelContext(true)
	const { passRevision } = useAtomValue(optimizationRuntimeAtom)
	const document = optimizer?._getDocument?.()
	return preview &&
		preview.source.document === document &&
		preview.source.passRevision === passRevision
		? preview
		: null
}

/*
  Owns the preview's lifetime from the publisher route, which outlives the
  panel: a preview gone stale is cleared, and a baked model is freed only once
  the viewer has stopped drawing it, after the commit that replaced it.
*/
function usePreviewLifetime(current: OcclusionBakePreview | null) {
	const [preview, setPreview] = useAtom(occlusionBakePreviewAtom)
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

/**
 * The baked model the viewer shows in place of the model: only while
 * `isLightingOpen`, the occlusion is set to baked, and the author shows it.
 * Call it once, from the publisher route: it also owns the preview's lifetime.
 */
export function useShownOcclusionBake(
	isLightingOpen: boolean
): Object3D | undefined {
	const preview = useCurrentPreview()
	usePreviewLifetime(preview)
	const lighting = useAtomValue(lightingAtom)
	return isLightingOpen &&
		resolveLighting({ lighting }).occlusion.mode === 'baked' &&
		preview?.status === 'ready' &&
		// A bake that changed nothing has no switch to turn it off, and its copy
		// would only freeze an animated model in its rest pose.
		Boolean(preview.report?.baked.length) &&
		preview.shown
		? preview.model
		: undefined
}

/**
 * Bakes the occlusion publishing would bake, off the main thread: the publish
 * worker runs with only the bake on, and its GLB is shown in place of the
 * model. One preview at a time; baking again replaces it.
 */
export function useOcclusionBakePreview() {
	const [, setPreview] = useAtom(occlusionBakePreviewAtom)
	const preview = useCurrentPreview()
	const { optimizer, file } = useModelContext(true)
	const { passRevision, isPending } = useAtomValue(optimizationRuntimeAtom)
	const exporter = useMemo(() => new ModelExporter(), [])
	const loader = useMemo(() => new ModelLoader(), [])
	const document = optimizer?._getDocument?.()

	// A pass rewrites the document in place, so a bake mid-pass would capture
	// a model that is neither the one before nor the one after.
	const canBake = Boolean(document) && !isPending

	const bake = useCallback(async () => {
		if (!document || isPending) return
		const source = { document, passRevision }
		const started = performance.now()
		// The model it replaces is freed once the viewer lets go of it.
		setPreview({ status: 'baking', source, shown: true })
		// Written only while this bake is still the latest one; a result that
		// lost was never drawn, so it is freed at once.
		const settle = (next: OcclusionBakePreview) =>
			setPreview((current) => {
				if (current?.source !== source) {
					if (next.model) disposeModel(next.model)
					return current
				}
				return next
			})

		try {
			const { data } = await exporter.exportDocumentGLB(document)
			const result = await runPublishExportInWorker(
				{
					buffer: data.slice().buffer as ArrayBuffer,
					dracoWorthApplying: true,
					ktx2: false,
					occlusion: true
				},
				() => {}
			)
			const report = result.occlusion
			if (!report || 'failed' in report) {
				throw new Error(report?.failed ?? 'Ambient occlusion was not baked')
			}
			const { scene } = await loader.loadToThreeJS(
				new File([result.buffer], 'baked.glb', { type: 'model/gltf-binary' })
			)
			settle({
				status: 'ready',
				source,
				shown: true,
				model: scene,
				report,
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
	}, [document, exporter, isPending, loader, passRevision, setPreview])

	const setShown = useCallback(
		(shown: boolean) =>
			setPreview((current) => (current ? { ...current, shown } : current)),
		[setPreview]
	)

	return {
		preview,
		canBake,
		isOptimizing: isPending,
		// The viewer draws the preview unanimated, in its rest pose.
		isAnimated: Boolean(file?.animations?.length),
		bake,
		setShown
	}
}
