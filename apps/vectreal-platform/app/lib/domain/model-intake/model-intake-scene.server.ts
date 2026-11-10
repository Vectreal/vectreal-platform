import { SCENE_THUMBNAIL_FILENAME } from '@vctrl/core'

import {
	intakeSceneFor,
	type ModelIntakeShowcase,
	parseIntakeScenes
} from './model-intake-shared'
import { reportServerError } from '../../observability/report-server-error.server'
import { buildEmbedUrl } from '../embed/embed-snippet'
import { buildInlineEmbedManifest } from '../embed/inline-embed-manifest.server'
import { readEmbedSceneSettings } from '../scene/server/scene-manifest.server'
import { getPublishedScenePreview } from '../scene/server/scene-preview-repository.server'

const HERO_EMBED_OPTIONS = [
	['autoRotate', '1'],
	['cameraControls', '0'],
	['hotspots', '0'],
	['hint', '0']
] as const

/** What an intake page's hero needs to show the product turning. */
export interface IntakeScene {
	/** The scene's own embed, on this deployment, key included. */
	embedPath: string
	/** The scene's stored thumbnail, painted while the embed loads. */
	posterUrl: string | null
	/** Names the scene for a screen reader. */
	title: string | null
}

export const intakeSceneDeps = {
	scenes: () => parseIntakeScenes(process.env.MODEL_INTAKE_SCENES),
	getPublishedScenePreview,
	readEmbedSceneSettings,
	buildInlineEmbedManifest,
	reportServerError
}

export type IntakeSceneDeps = typeof intakeSceneDeps

/**
 * The published scene an intake page turns at the top: the one for the
 * letter's showcase, else the default. The poster comes from the same
 * manifest the embed itself serves, so it is the frame the embed opens on.
 * Null when none is configured or the scene is not published, and the page
 * then leads with its text: a hero must never fail the page.
 */
export async function resolveIntakeScene(
	request: Request,
	showcase: ModelIntakeShowcase | null,
	deps: IntakeSceneDeps = intakeSceneDeps
): Promise<IntakeScene | null> {
	const parsed = deps.scenes()
	if (!parsed.ok) {
		deps.reportServerError(new Error(`MODEL_INTAKE_SCENES: ${parsed.error}`), {
			request
		})
		return null
	}
	const ref = intakeSceneFor(parsed.scenes, showcase)
	if (!ref) return null

	try {
		const [previewScene, settingsData] = await Promise.all([
			deps.getPublishedScenePreview(ref.projectId, ref.sceneId),
			deps.readEmbedSceneSettings(ref.sceneId)
		])
		if (!previewScene) return null
		const manifest = await deps.buildInlineEmbedManifest(request, {
			projectId: ref.projectId,
			sceneId: ref.sceneId,
			previewScene,
			settingsData,
			token: ref.token,
			allowUnsignedWithoutToken: false
		})
		const thumbnail = Object.values(manifest?.assetRefs ?? {}).find(
			(asset) => asset.fileName === SCENE_THUMBNAIL_FILENAME
		)
		const embed = new URL(
			buildEmbedUrl({
				origin: 'http://localhost',
				projectId: ref.projectId,
				sceneId: ref.sceneId,
				token: ref.token
			})
		)
		// A product turning in a hero, not a viewer to work: it turns whatever
		// the scene's own setting says, and draws no switcher, markers or hint.
		for (const [key, value] of HERO_EMBED_OPTIONS) {
			embed.searchParams.set(key, value)
		}
		return {
			embedPath: `${embed.pathname}${embed.search}`,
			posterUrl: thumbnail?.url ?? null,
			title: manifest?.meta?.name ?? null
		}
	} catch (error) {
		deps.reportServerError(error, {
			request,
			properties: { sceneId: ref.sceneId }
		})
		return null
	}
}
