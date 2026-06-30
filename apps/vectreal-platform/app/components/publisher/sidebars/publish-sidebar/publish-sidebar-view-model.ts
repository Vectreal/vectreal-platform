import type { ResolvedSceneMetrics } from '../../../../lib/domain/scene'
import type { ScenePublishStateResponse } from '../../../../types/api'

type PublishMetricSizeInfo = {
	initialSceneBytes?: number | null
	currentSceneBytes?: number | null
	isInitialMetricsHydrating?: boolean
}

export interface PublishSidebarViewModel {
	metrics: ResolvedSceneMetrics | null
	sizeReductionPercent: null | number
	sizeDeltaBytes: null | number
	isHydratingInitialMetrics: boolean
	publishMetricSizeInfo: PublishMetricSizeInfo
	publishState: ScenePublishStateResponse
	isAuthenticated: boolean
	hasSavedScene: boolean
	canAccessPublishFeatures: boolean
}

const getSizeReductionPercent = (
	before?: number | null,
	after?: number | null
): null | number => {
	if (
		typeof before !== 'number' ||
		typeof after !== 'number' ||
		before <= 0 ||
		after > before
	) {
		return null
	}

	return Math.round(((before - after) / before) * 100)
}

const getSizeDeltaBytes = (
	before?: number | null,
	after?: number | null
): null | number => {
	if (typeof before !== 'number' || typeof after !== 'number') {
		return null
	}

	return before - after
}

export const buildPublishSidebarViewModel = ({
	sceneId,
	sessionSavedSceneId,
	userId,
	publishedAt,
	publishedAssetSizeBytes,
	resolvedMetrics
}: {
	sceneId?: string
	sessionSavedSceneId?: string
	userId?: string
	publishedAt?: string | null
	publishedAssetSizeBytes?: number | null
	resolvedMetrics?: ResolvedSceneMetrics | null
}): PublishSidebarViewModel => {
	const metrics = resolvedMetrics ?? null
	const sizeReductionPercent = getSizeReductionPercent(
		metrics?.sceneBytes.initial,
		metrics?.sceneBytes.current
	)
	const sizeDeltaBytes = getSizeDeltaBytes(
		metrics?.sceneBytes.initial,
		metrics?.sceneBytes.current
	)
	const isHydratingInitialMetrics = Boolean(metrics?.isInitialMetricsHydrating)
	const isAuthenticated = Boolean(userId)
	// Treat the scene as saved when the route already carries its id OR a save has
	// been confirmed this session. The latter bridges the window between a first
	// save completing and the route updating to /publisher/:newId, so the publish
	// sections reveal immediately instead of flickering or staying on "save".
	const resolvedSceneId =
		(typeof sceneId === 'string' && sceneId.length > 0 && sceneId) ||
		(typeof sessionSavedSceneId === 'string' &&
			sessionSavedSceneId.length > 0 &&
			sessionSavedSceneId) ||
		''
	const hasSavedScene = resolvedSceneId.length > 0

	return {
		metrics,
		sizeReductionPercent,
		sizeDeltaBytes,
		isHydratingInitialMetrics,
		publishMetricSizeInfo: {
			initialSceneBytes: metrics?.sceneBytes.initial,
			currentSceneBytes: metrics?.sceneBytes.current,
			isInitialMetricsHydrating: isHydratingInitialMetrics
		},
		publishState: {
			sceneId: resolvedSceneId,
			status: publishedAt ? 'published' : 'draft',
			publishedAt: publishedAt ?? null,
			publishedAssetId: null,
			publishedAssetSizeBytes: publishedAssetSizeBytes ?? null
		},
		isAuthenticated,
		hasSavedScene,
		canAccessPublishFeatures: isAuthenticated && hasSavedScene
	}
}
