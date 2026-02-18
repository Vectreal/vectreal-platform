import { useCallback, useEffect, useState } from 'react'

import type {
	SceneAggregateResponse,
	SceneStatsData,
	SceneStatsUpdatedDetail
} from '../types/api'

/**
 * Hook to fetch the latest scene statistics from the server.
 */
export function useFetchSceneStats() {
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	/**
	 * Fetches the latest scene stats for a given scene ID
	 */
	const fetchSceneStats = useCallback(
		async (sceneId: string): Promise<SceneStatsData | null> => {
			setLoading(true)
			setError(null)

			try {
				const response = await fetch(`/api/scenes/${sceneId}`, {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json'
					}
				})

				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`)
				}

				const result = await response.json()

				if (result.error) {
					throw new Error(result.error)
				}

				const aggregate = result.data as SceneAggregateResponse | undefined
				return aggregate?.stats || null
			} catch (err) {
				const error =
					err instanceof Error ? err : new Error('Failed to fetch scene stats')
				setError(error)
				throw error
			} finally {
				setLoading(false)
			}
		},
		[]
	)

	return {
		fetchSceneStats,
		loading,
		error
	}
}

/**
 * Hook to fetch the latest scene stats for a specific scene.
 * Automatically loads on mount and provides refresh functionality.
 *
 * @param sceneId - The scene ID to fetch stats for
 * @param autoLoad - Whether to automatically load stats on mount (default: true)
 */
export function useLatestSceneStats(sceneId: string, autoLoad = true) {
	const [stats, setStats] = useState<SceneStatsData | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	const fetchLatestStats = useCallback(async () => {
		if (!sceneId) return

		setLoading(true)
		setError(null)

		try {
			const response = await fetch(`/api/scenes/${sceneId}`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			})

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`)
			}

			const result = await response.json()

			if (result.error) {
				throw new Error(result.error)
			}

			const aggregate = result.data as SceneAggregateResponse | undefined
			setStats(aggregate?.stats || null)
		} catch (err) {
			const error =
				err instanceof Error
					? err
					: new Error('Failed to fetch latest scene stats')
			setError(error)
			console.error('Failed to fetch latest scene stats:', error)
		} finally {
			setLoading(false)
		}
	}, [sceneId])

	useEffect(() => {
		if (autoLoad && sceneId) {
			fetchLatestStats()
		}
	}, [autoLoad, sceneId, fetchLatestStats])

	useEffect(() => {
		if (!sceneId) return

		const handler = (event: Event) => {
			const detail = (event as CustomEvent<SceneStatsUpdatedDetail>).detail
			if (detail?.sceneId && detail.sceneId !== sceneId) {
				return
			}
			fetchLatestStats()
		}

		window.addEventListener('scene-stats-updated', handler)
		return () => window.removeEventListener('scene-stats-updated', handler)
	}, [sceneId, fetchLatestStats])

	return {
		stats,
		loading,
		error,
		refresh: fetchLatestStats
	}
}
