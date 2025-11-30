import { useCallback, useEffect, useState } from 'react'

import type { SceneStatsData } from '../types/api'

/**
 * Hook to fetch and manage scene statistics from the server.
 * Provides methods to query scene stats by scene ID, version, or label.
 */
export function useFetchSceneStats() {
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	/**
	 * Fetches scene stats for a given scene ID with optional filters
	 */
	const fetchSceneStats = useCallback(
		async (
			sceneId: string,
			options?: {
				version?: number
				label?: string
				limit?: number
			}
		): Promise<SceneStatsData[]> => {
			setLoading(true)
			setError(null)

			try {
				const params = new URLSearchParams({ sceneId })

				if (options?.version !== undefined) {
					params.append('version', options.version.toString())
				}
				if (options?.label) {
					params.append('label', options.label)
				}
				if (options?.limit) {
					params.append('limit', options.limit.toString())
				}

				const response = await fetch(`/api/scene-stats?${params.toString()}`, {
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

				return result.data || []
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
			const response = await fetch(
				`/api/scene-stats?sceneId=${sceneId}&limit=1`,
				{
					method: 'GET',
					headers: {
						'Content-Type': 'application/json'
					}
				}
			)

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`)
			}

			const result = await response.json()

			if (result.error) {
				throw new Error(result.error)
			}

			const data = result.data
			setStats(data && data.length > 0 ? data[0] : null)
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

	return {
		stats,
		loading,
		error,
		refresh: fetchLatestStats
	}
}

/**
 * Hook to fetch the complete history of scene stats for a specific scene.
 * Returns all versions ordered by version number (descending).
 *
 * @param sceneId - The scene ID to fetch stats history for
 * @param autoLoad - Whether to automatically load history on mount (default: true)
 */
export function useSceneStatsHistory(sceneId: string, autoLoad = true) {
	const [history, setHistory] = useState<SceneStatsData[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	const fetchHistory = useCallback(async () => {
		if (!sceneId) return

		setLoading(true)
		setError(null)

		try {
			const response = await fetch(`/api/scene-stats?sceneId=${sceneId}`, {
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

			setHistory(result.data || [])
		} catch (err) {
			const error =
				err instanceof Error
					? err
					: new Error('Failed to fetch scene stats history')
			setError(error)
			console.error('Failed to fetch scene stats history:', error)
		} finally {
			setLoading(false)
		}
	}, [sceneId])

	useEffect(() => {
		if (autoLoad && sceneId) {
			fetchHistory()
		}
	}, [autoLoad, sceneId, fetchHistory])

	return {
		history,
		loading,
		error,
		refresh: fetchHistory
	}
}

/**
 * Hook to compare two scene stats snapshots.
 * Useful for showing before/after optimization comparisons.
 */
export function useSceneStatsComparison(
	sceneId: string,
	beforeLabel?: string,
	afterLabel?: string
) {
	const [beforeStats, setBeforeStats] = useState<SceneStatsData | null>(null)
	const [afterStats, setAfterStats] = useState<SceneStatsData | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	const fetchComparison = useCallback(async () => {
		if (!sceneId) return

		setLoading(true)
		setError(null)

		try {
			// Fetch both stats in parallel
			const [beforeResponse, afterResponse] = await Promise.all([
				fetch(
					`/api/scene-stats?sceneId=${sceneId}${beforeLabel ? `&label=${beforeLabel}` : '&limit=1'}`,
					{
						method: 'GET',
						headers: { 'Content-Type': 'application/json' }
					}
				),
				afterLabel
					? fetch(`/api/scene-stats?sceneId=${sceneId}&label=${afterLabel}`, {
							method: 'GET',
							headers: { 'Content-Type': 'application/json' }
						})
					: Promise.resolve(null)
			])

			if (!beforeResponse.ok) {
				throw new Error(`HTTP error! status: ${beforeResponse.status}`)
			}

			const beforeResult = await beforeResponse.json()
			if (beforeResult.error) {
				throw new Error(beforeResult.error)
			}

			setBeforeStats(
				beforeResult.data && beforeResult.data.length > 0
					? beforeResult.data[0]
					: null
			)

			if (afterResponse && afterLabel) {
				if (!afterResponse.ok) {
					throw new Error(`HTTP error! status: ${afterResponse.status}`)
				}

				const afterResult = await afterResponse.json()
				if (afterResult.error) {
					throw new Error(afterResult.error)
				}

				setAfterStats(
					afterResult.data && afterResult.data.length > 0
						? afterResult.data[0]
						: null
				)
			} else {
				setAfterStats(null)
			}
		} catch (err) {
			const error =
				err instanceof Error
					? err
					: new Error('Failed to fetch scene stats comparison')
			setError(error)
			console.error('Failed to fetch scene stats comparison:', error)
		} finally {
			setLoading(false)
		}
	}, [sceneId, beforeLabel, afterLabel])

	useEffect(() => {
		if (sceneId) {
			fetchComparison()
		}
	}, [sceneId, fetchComparison])

	return {
		beforeStats,
		afterStats,
		loading,
		error,
		refresh: fetchComparison
	}
}
