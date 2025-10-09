import { useExportModel } from '@vctrl/hooks/use-export-model'
import { useModelContext } from '@vctrl/hooks/use-load-model'
import { useAtom } from 'jotai/react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
	controlsAtom,
	environmentAtom,
	metaAtom,
	shadowsAtom,
	toneMappingAtom
} from '../../../lib/stores/publisher-config-store'
import type { SceneSettingsData } from '../../../types/api'

export interface UseSceneSettingsParams {
	sceneId: null | string
	userId?: string
	assetIds?: string[]
}

export function useSceneSettings(
	{ sceneId, userId, assetIds }: UseSceneSettingsParams = {
		sceneId: null,
		assetIds: [],
		userId: undefined
	}
) {
	const [isLoading, setIsLoading] = useState(false)
	const [lastSavedSettings, setLastSavedSettings] =
		useState<SceneSettingsData | null>(null)
	const [currentSceneId, setCurrentSceneId] = useState<string | null>(sceneId)
	const [currentAssetIds, setCurrentAssetIds] = useState<string[]>(
		assetIds || []
	)

	const { optimizer, file } = useModelContext(true)
	const { handleDocumentGltfExport } = useExportModel()

	// Update currentSceneId when sceneId prop changes
	useEffect(() => {
		setCurrentSceneId(sceneId)
	}, [sceneId])

	// Update currentAssetIds when sceneId prop changes
	useEffect(() => {
		setCurrentAssetIds([])
	}, [assetIds])

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

			const gltfDocument = optimizer._getDocument()
			const gltfJson = await handleDocumentGltfExport(
				gltfDocument,
				file,
				false,
				false
			)

			console.log('Gltf JSON:', gltfJson)

			// Convert Map to array for JSON serialization
			let gltfJsonToSend: unknown = gltfJson
			if (gltfJson && typeof gltfJson === 'object' && 'assets' in gltfJson) {
				const assets = gltfJson.assets
				if (assets instanceof Map) {
					// Convert Map to array of SerializedAsset objects
					const serializedAssets = Array.from(assets.entries()).map(
						([fileName, data]) => ({
							fileName,
							data: Array.from(data), // Convert Uint8Array to number array
							mimeType: fileName.endsWith('.bin')
								? 'application/octet-stream'
								: fileName.endsWith('.png')
									? 'image/png'
									: fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')
										? 'image/jpeg'
										: fileName.endsWith('.webp')
											? 'image/webp'
											: 'application/octet-stream'
						})
					)

					gltfJsonToSend = {
						...gltfJson,
						assets: serializedAssets
					}

					console.log(
						`Serialized ${serializedAssets.length} assets for transfer`
					)
				}
			}

			formData.append('action', 'save-scene-settings')
			formData.append('sceneId', currentSceneId || '')
			formData.append('userId', userId)
			formData.append('settings', JSON.stringify(currentSettings))
			formData.append('assetIds', JSON.stringify(currentAssetIds))
			formData.append('gltfJson', JSON.stringify(gltfJsonToSend))

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
	}, [
		currentSceneId,
		currentAssetIds,
		currentSettings,
		optimizer,
		file,
		userId,
		handleDocumentGltfExport
	])

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
	// BUT only if no model is currently loaded in the publisher
	useEffect(() => {
		// Don't auto-load if a model is already loaded - this prevents reloading
		// when saving an existing scene or when the user has already loaded a model
		if (file?.model) {
			console.log('Model already loaded, skipping auto-load of scene settings')
			return
		}

		if (currentSceneId && currentSceneId.trim() !== '') {
			console.log('Loading scene settings for scene ID:', currentSceneId)
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
	}, [currentSceneId, loadSceneSettings, file?.model])

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
