import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtom, useAtomValue } from 'jotai/react'
import { useEffect, useMemo, useRef } from 'react'

import { originalPreset } from '../../../constants/optimizations'
import { optimizationsMatch } from '../../../lib/domain/scene/client/optimization-inference'
import {
	projectPublishedGlbBytes,
	resolvePublishGeometryOptions
} from '../../../lib/domain/scene/client/publish-export'
import { shouldCompressTexturesForGpu } from '../../../lib/domain/scene/scene-presentation'
import { bakesKey } from '../../../lib/domain/scene/studio-finish'
import { lastSavedSettingsAtom } from '../../../lib/stores/publisher-config-store'
import {
	documentOptimizationsAtom,
	optimizationRuntimeAtom
} from '../../../lib/stores/scene-optimization-store'
import {
	lightingAtom,
	presentationAtom
} from '../../../lib/stores/scene-settings-store'

/**
 * Whether publish encodes this scene's textures for the GPU: the author's
 * choice, or by default whenever the document is optimized.
 */
export function useCompressesTexturesForGpu(): boolean {
	const optimizations = useAtomValue(documentOptimizationsAtom)
	const presentation = useAtomValue(presentationAtom)
	return shouldCompressTexturesForGpu(presentation, {
		isOriginalPreset: optimizationsMatch(optimizations, originalPreset)
	})
}

/**
 * Whether the published file is what publishing now would ship. The server
 * answers for the saved scene (`publishedIsCurrent`); what it cannot see is
 * anything this tab has not saved yet that changes the file, which is a pass,
 * the GPU texture switch or what the lighting bakes in. Every other unsaved
 * edit is a setting, and an embed reads those live once saved, so it leaves
 * the published file current.
 *
 * Read by both claims about the published file: the publish card's status and
 * whether the size shown is the published one.
 */
export function usePublishedFileIsCurrent(): boolean {
	const optimizations = useAtomValue(documentOptimizationsAtom)
	const presentation = useAtomValue(presentationAtom)
	const lighting = useAtomValue(lightingAtom)
	const lastSavedSettings = useAtomValue(lastSavedSettingsAtom)
	const { passRevision, savedPassRevision, latestSceneStats } = useAtomValue(
		optimizationRuntimeAtom
	)

	// With no unsaved pass the saved settings are these optimizations, so the
	// switch's default resolves the same on both sides.
	const isOriginalPreset = optimizationsMatch(optimizations, originalPreset)
	const compressesTextures = shouldCompressTexturesForGpu(presentation, {
		isOriginalPreset
	})
	const savedCompressesTextures = lastSavedSettings
		? shouldCompressTexturesForGpu(lastSavedSettings.presentation, {
				isOriginalPreset
			})
		: compressesTextures

	return (
		latestSceneStats?.publishedIsCurrent !== false &&
		passRevision === savedPassRevision &&
		compressesTextures === savedCompressesTextures &&
		(!lastSavedSettings ||
			bakesKey(lighting) === bakesKey(lastSavedSettings.lighting))
	)
}

/**
 * Whether the size shown leaves out GPU texture encoding: a projection, for a
 * scene whose publish will encode its textures by an amount only the encode
 * can tell.
 */
export function useSizeExcludesTextureEncoding(): boolean {
	const compressesTextures = useCompressesTexturesForGpu()
	const { optimizedSceneBytes, publishedEncoding } = useAtomValue(
		optimizationRuntimeAtom
	)
	return (
		compressesTextures &&
		typeof optimizedSceneBytes === 'number' &&
		!publishedEncoding
	)
}

/**
 * Measures what the document on screen publishes at, by running publish's own
 * export without GPU texture encoding, so the size shown is in the geometry
 * codec publish will pick rather than a guess at one.
 *
 * Runs once the document settles: when a scene opens and after every pass,
 * and again whenever hydration clears the figure. A published scene whose
 * published file is current keeps the size its publish recorded, because that
 * is the file visitors get; once the model or its encoding changes, saved or
 * not, the next publish is the figure to show.
 *
 * Publisher only. The embed and preview routes never mount it.
 */
export function usePublishSizeProjection() {
	const model = useModelContext(true)
	const { optimizer } = model
	const loadId = model.status === 'ready' ? model.loadId : null
	const optimizations = useAtomValue(documentOptimizationsAtom)
	const publishedFileIsCurrent = usePublishedFileIsCurrent()
	const [runtime, setRuntime] = useAtom(optimizationRuntimeAtom)
	const {
		isPending,
		passRevision,
		dracoReport,
		latestSceneStats,
		optimizedSceneBytes,
		publishedEncoding
	} = runtime

	// Only a publish stores a current size, and a revoke clears it.
	const isPublished = typeof latestSceneStats?.currentSceneBytes === 'number'
	const keepsPublishedSize = isPublished && publishedFileIsCurrent
	const canProject =
		optimizer.isReady && !isPending && loadId !== null && !keepsPublishedSize

	const geometry = useMemo(
		() => resolvePublishGeometryOptions(optimizations, dracoReport),
		[optimizations, dracoReport]
	)
	// The document and the encoding a projection describes.
	const key = `${loadId}:${passRevision}:${JSON.stringify(geometry)}`

	const keyRef = useRef(key)
	keyRef.current = key
	const canProjectRef = useRef(canProject)
	canProjectRef.current = canProject
	const optimizerRef = useRef(optimizer)
	optimizerRef.current = optimizer
	const publishedEncodingRef = useRef(publishedEncoding)
	publishedEncodingRef.current = publishedEncoding
	const measuredKeyRef = useRef<string | null>(null)

	const needsFigure = optimizedSceneBytes === null

	useEffect(() => {
		if (!canProject) {
			// Whatever is shown meanwhile (a published size) is not a projection
			// of this key, so the next chance to project measures again.
			measuredKeyRef.current = null
			setRuntime((prev) => {
				let next = prev
				// A projection this abandoned cannot clear its own flag.
				if (prev.isProjectingSceneBytes) {
					next = { ...next, isProjectingSceneBytes: false }
				}
				// Back to the published file being current, it is the figure again,
				// read from the stored stats once the projection is out of the way.
				if (
					keepsPublishedSize &&
					prev.optimizedSceneBytes !== null &&
					!prev.publishedEncoding
				) {
					next = { ...next, optimizedSceneBytes: null }
				}
				return next
			})
			return
		}
		if (measuredKeyRef.current === key && !needsFigure) return
		measuredKeyRef.current = key

		const isCurrent = () => keyRef.current === key && canProjectRef.current
		const encodingAtStart = publishedEncodingRef.current

		setRuntime((prev) => ({ ...prev, isProjectingSceneBytes: true }))
		void (async () => {
			try {
				const working = await optimizerRef.current.getModel()
				if (!working) throw new Error('No model to measure')
				const bytes = await projectPublishedGlbBytes(working, geometry)
				if (!isCurrent()) return
				setRuntime((prev) => ({
					...prev,
					isProjectingSceneBytes: false,
					// A publish that landed meanwhile measured the real file. Otherwise
					// the projection replaces any earlier publish's figure, which no
					// longer describes what publishing would ship.
					...(prev.publishedEncoding !== encodingAtStart
						? {}
						: { optimizedSceneBytes: bytes, publishedEncoding: null })
				}))
			} catch (error) {
				if (!isCurrent()) return
				console.error('Failed to project the published size:', error)
				setRuntime((prev) => ({ ...prev, isProjectingSceneBytes: false }))
			}
		})()
	}, [canProject, keepsPublishedSize, key, needsFigure, geometry, setRuntime])
}
