import { SCENE_THUMBNAIL_FILENAME } from '@vctrl/core'

import { buildEmbedUrl } from './embed-snippet'
import { buildInlineEmbedManifest } from './inline-embed-manifest.server'
import { reportServerError } from '../../observability/report-server-error.server'
import { readEmbedSceneSettings } from '../scene/server/scene-manifest.server'
import { getPublishedScenePreview } from '../scene/server/scene-preview-repository.server'

import type { EmbedSceneRef } from './embed-scene-ref'

/** What a page of ours needs to show one of our published scenes through its own embed. */
export interface PublishedEmbedScene {
	/** The scene's own embed, on this deployment, key included. */
	embedPath: string
	/** The scene's stored thumbnail, painted while the embed loads. */
	posterUrl: string | null
	/** Names the scene for a screen reader. */
	title: string | null
}

export const publishedEmbedSceneDeps = {
	getPublishedScenePreview,
	readEmbedSceneSettings,
	buildInlineEmbedManifest,
	reportServerError
}

export type PublishedEmbedSceneDeps = typeof publishedEmbedSceneDeps

/**
 * A published scene a page of ours shows from config, as an embed path with
 * `options` set on it. The poster comes from the same manifest the embed
 * itself serves, so it is the frame the embed opens on. Null when the scene is
 * not published or anything fails: a scene shown on one of our pages must
 * never fail the page.
 */
export async function resolvePublishedEmbedScene(
	request: Request,
	ref: EmbedSceneRef,
	options: readonly (readonly [string, string])[],
	deps: PublishedEmbedSceneDeps = publishedEmbedSceneDeps
): Promise<PublishedEmbedScene | null> {
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
		for (const [key, value] of options) embed.searchParams.set(key, value)
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
