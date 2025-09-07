import { useAtom } from 'jotai/react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
	controlsAtom,
	environmentAtom,
	metaAtom,
	shadowsAtom,
	toneMappingAtom
} from '../stores/publisher-config-store'

import type { SceneSettingsData } from '../types/api'

export interface UseSceneSettingsParams {
	sceneId: null | string
	userId?: string
}

export function useSceneSettings(
	{ sceneId, userId }: UseSceneSettingsParams = {
		sceneId: null,
		userId: undefined
	}
) {
	const [isLoading, setIsLoading] = useState(false)
	const [lastSavedSettings, setLastSavedSettings] =
		useState<SceneSettingsData | null>(null)
	const [currentSceneId, setCurrentSceneId] = useState<string | null>(sceneId)

	// Update currentSceneId when sceneId prop changes
	useEffect(() => {
		setCurrentSceneId(sceneId)
	}, [sceneId])

	// Get current settings from atoms
	const [environment] = useAtom(environmentAtom)
	const [toneMapping] = useAtom(toneMappingAtom)
	const [controls] = useAtom(controlsAtom)
	const [shadows] = useAtom(shadowsAtom)
	const [meta] = useAtom(metaAtom)

	const currentSettings: SceneSettingsData = useMemo(
		() => ({
			environment,
			toneMapping,
			controls,
			shadows,
			meta
		}),
		[environment, toneMapping, controls, shadows, meta]
	)

	/**
	 * Save current scene settings to database
	 */
	const saveSceneSettings = useCallback(async () => {
		if (!userId) {
			console.error('No user ID provided for saving settings')
			throw new Error('No user ID provided for saving settings')
		}

		if (!currentSceneId) {
			console.log('No scene ID provided, new scene will be created on save')
		}

		setIsLoading(true)
		try {
			const formData = new FormData()
			formData.append('action', 'save-scene-settings')
			formData.append('sceneId', currentSceneId || '')
			formData.append('userId', userId)
			formData.append('settingsData', JSON.stringify(currentSettings))

			// Use fetch instead of fetcher to get proper response handling
			const response = await fetch('/api/scene-settings', {
				method: 'POST',
				body: formData
			})

			const result = await response.json()

			// Check if the response contains an error
			if (!response.ok || result.error) {
				throw new Error(
					result.error || `HTTP error! status: ${response.status}`
				)
			}

			// Extract data from API response structure { data: {...}, success: true }
			const data = result.data || result

			// Check if settings were unchanged
			if (data.unchanged) {
				return { unchanged: true }
			}

			// Update the current scene ID if it was generated server-side
			if (data.sceneId && !currentSceneId) {
				setCurrentSceneId(data.sceneId)
			}

			// Update last saved settings for comparison
			setLastSavedSettings(currentSettings)

			// Return the actual result from the API
			return data
		} catch (error) {
			console.error('Failed to save scene settings:', error)
			throw error // Re-throw to let the SaveButton handle the error
		} finally {
			setIsLoading(false)
		}
	}, [currentSceneId, userId, currentSettings])

	/**
	 * Load scene settings from database and update atoms
	 */
	const loadSceneSettings = useCallback(
		async (targetSceneId?: string) => {
			const idToLoad = targetSceneId || currentSceneId
			if (!idToLoad) {
				console.warn('No scene ID provided for loading settings')
				throw new Error('No scene ID provided for loading settings')
			}

			setIsLoading(true)
			try {
				const formData = new FormData()
				formData.append('action', 'get-scene-settings')
				formData.append('sceneId', idToLoad)

				const response = await fetch('/api/scene-settings', {
					method: 'POST',
					body: formData
				})

				const result = await response.json()

				// Check if the response contains an error
				if (!response.ok || result.error) {
					throw new Error(
						result.error || `HTTP error! status: ${response.status}`
					)
				}

				// Extract data from API response structure { data: {...}, success: true }
				const data = result.data || result

				// Update saved settings baseline if settings were loaded
				if (data) {
					const loadedSettings: SceneSettingsData = {
						environment: data.environment,
						toneMapping: data.toneMapping,
						controls: data.controls,
						shadows: data.shadows,
						meta: data.meta
					}
					setLastSavedSettings(loadedSettings)
				}

				// In a real implementation, you would update atoms with the loaded settings
				return data
			} catch (error) {
				console.error('Failed to load scene settings:', error)
				throw error // Re-throw to let caller handle the error
			} finally {
				setIsLoading(false)
			}
		},
		[currentSceneId]
	)

	/**
	 * Create a new version of scene settings
	 */
	const createNewVersion = useCallback(
		async (assetIds: string[] = []) => {
			if (!currentSceneId || !userId) {
				console.warn('Missing required parameters for creating new version')
				throw new Error('Missing required parameters for creating new version')
			}

			setIsLoading(true)
			try {
				const formData = new FormData()
				formData.append('action', 'create-version')
				formData.append('sceneId', currentSceneId)
				formData.append('userId', userId)
				formData.append('settingsData', JSON.stringify(currentSettings))
				if (assetIds.length > 0) {
					formData.append('assetIds', JSON.stringify(assetIds))
				}

				const response = await fetch('/api/scene-settings', {
					method: 'POST',
					body: formData
				})

				const result = await response.json()

				// Check if the response contains an error
				if (!response.ok || result.error) {
					throw new Error(
						result.error || `HTTP error! status: ${response.status}`
					)
				}

				// Extract data from API response structure { data: {...}, success: true }
				const data = result.data || result

				return data
			} catch (error) {
				console.error('Failed to create new version:', error)
				throw error // Re-throw to let caller handle the error
			} finally {
				setIsLoading(false)
			}
		},
		[currentSceneId, userId, currentSettings]
	)

	/**
	 * Check if current settings have been modified since last save
	 */
	const hasUnsavedChanges = useCallback(() => {
		if (!lastSavedSettings) {
			// If no saved settings exist but we have current settings, there are changes
			return !!(
				currentSettings.environment ||
				currentSettings.toneMapping ||
				currentSettings.controls ||
				currentSettings.shadows ||
				currentSettings.meta
			)
		}

		// Deep comparison of current vs last saved settings
		return (
			JSON.stringify(currentSettings.environment) !==
				JSON.stringify(lastSavedSettings.environment) ||
			JSON.stringify(currentSettings.toneMapping) !==
				JSON.stringify(lastSavedSettings.toneMapping) ||
			JSON.stringify(currentSettings.controls) !==
				JSON.stringify(lastSavedSettings.controls) ||
			JSON.stringify(currentSettings.shadows) !==
				JSON.stringify(lastSavedSettings.shadows) ||
			JSON.stringify(currentSettings.meta) !==
				JSON.stringify(lastSavedSettings.meta)
		)
	}, [currentSettings, lastSavedSettings])

	// Load settings when currentSceneId changes and it's an existing scene
	useEffect(() => {
		if (currentSceneId && currentSceneId.trim() !== '') {
			loadSceneSettings().catch((error) => {
				// If loading fails, it might be a new scene, so reset saved settings
				console.log(
					'Could not load existing settings, treating as new scene:',
					error.message
				)
				setLastSavedSettings(null)
			})
		} else {
			// No scene ID, reset saved settings
			setLastSavedSettings(null)
		}
	}, [currentSceneId, loadSceneSettings])

	return {
		// State
		isLoading,
		currentSettings,
		lastSavedSettings,
		currentSceneId,

		// Actions
		saveSceneSettings,
		loadSceneSettings,
		createNewVersion,
		hasUnsavedChanges
	}
}
