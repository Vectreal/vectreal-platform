import { ModelExporter } from '@vctrl/core/model-exporter'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { useEffect, useMemo } from 'react'

import { planStudioFinishInWorker } from '../../../../../lib/domain/scene/client/publish-export'
import { studioFinishPlanAtom } from '../../../../../lib/stores/publisher-config-store'
import { optimizationRuntimeAtom } from '../../../../../lib/stores/scene-optimization-store'

import type { StudioFinishPlan } from '../../../../../workers/publish-export.worker.types'

/**
 * Plans the studio finish for each document and optimization pass, as soon
 * as one is settled, so the Lighting tool can say before any preview which
 * bake has nothing to draw. Call it once, from the publisher route.
 *
 * A plan is stored with the document and pass it was made from, and only
 * while that run is still the latest: one that lands after the author moved
 * on is dropped, and `useStudioFinishPlan` ignores any other stale one.
 */
export function usePlanStudioFinish() {
	const setPlan = useSetAtom(studioFinishPlanAtom)
	const { optimizer } = useModelContext(true)
	const { passRevision, isPending } = useAtomValue(optimizationRuntimeAtom)
	const exporter = useMemo(() => new ModelExporter(), [])
	const document = optimizer?._getDocument?.()

	useEffect(() => {
		// A plan for another document or pass is let go of, with its document,
		// even if this one is never made.
		setPlan((current) =>
			current?.source.document === document &&
			current?.source.passRevision === passRevision
				? current
				: null
		)
		// A pass rewrites the document in place, so it is planned once settled.
		if (!document || isPending) return
		let latest = true
		const source = { document, passRevision }
		void (async () => {
			try {
				const { data } = await exporter.exportDocumentGLB(document)
				const plan = await planStudioFinishInWorker(data)
				if (latest) setPlan({ source, plan })
			} catch (error) {
				// Without a plan the finish works as before: the preview reports
				// what it could not take.
				console.warn('Planning the studio finish failed:', error)
			}
		})()
		return () => {
			latest = false
		}
	}, [document, passRevision, isPending, exporter, setPlan])

	// The plan holds the document; it goes with the publisher.
	useEffect(() => () => setPlan(null), [setPlan])
}

/** The studio finish plan for the document and pass on screen, once made. */
export function useStudioFinishPlan(): StudioFinishPlan | null {
	const state = useAtomValue(studioFinishPlanAtom)
	const { optimizer } = useModelContext(true)
	const { passRevision } = useAtomValue(optimizationRuntimeAtom)
	const document = optimizer?._getDocument?.()
	return state &&
		state.source.document === document &&
		state.source.passRevision === passRevision
		? state.plan
		: null
}
