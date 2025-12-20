import { SceneSettings } from '@vctrl/core'
import { useExportModel } from '@vctrl/hooks/use-export-model'
import type { ModelFile } from '@vctrl/hooks/use-load-model'
import { OptimizerIntegrationReturn } from '@vctrl/hooks/use-load-model/types'
import { useCallback } from 'react'

import type { SaveSceneResult } from './use-scene-loader'

interface UseScenePersistenceParams {
	currentSceneId: string | null
	userId?: string
	assetIds?: string[]
	currentSettings: SceneSettings
	optimizer: OptimizerIntegrationReturn<boolean> | null
	modelFile: ModelFile | null
}

/**
 * Hook to handle scene persistence operations (save, load, version)
 * Extracted from useSceneLoader to separate concerns
 */
export function useScenePersistence({
	currentSceneId,
	userId,
	assetIds = [],
	currentSettings,
	optimizer,
	modelFile
}: UseScenePersistenceParams) {
	const { handleDocumentGltfExport } = useExportModel()

	/**
	 * Serialize GLTF document with assets for transfer
	 */
	const serializeGltfDocument = useCallback(async () => {
		if (!optimizer || !modelFile || !optimizer._getDocument()) {
			return null
		}

		const gltfDocument = optimizer._getDocument()
		const gltfJson = await handleDocumentGltfExport(
			gltfDocument,
			modelFile,
			false,
			false
		)

		if (!gltfJson || typeof gltfJson !== 'object' || !('assets' in gltfJson)) {
			return gltfJson
		}

		const assets = gltfJson.assets
		if (!(assets instanceof Map)) {
			return gltfJson
		}

		const serializedAssets = Array.from(assets.entries()).map(
			([fileName, data]) => ({
				fileName,
				data: Array.from(data),
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

		return {
			...gltfJson,
			assets: serializedAssets
		}
	}, [optimizer, modelFile, handleDocumentGltfExport])

	/**
	 * Save current scene settings to database
	 */
	const saveSceneSettings = useCallback(async (): Promise<
		SaveSceneResult | { unchanged: true } | undefined
	> => {
		if (!userId) {
			throw new Error('No user ID provided for saving settings')
		}

		try {
			const gltfJsonToSend = await serializeGltfDocument()

			// Get optimization report if available
			let optimizationReport = null
			if (optimizer && optimizer.report) {
				optimizationReport = optimizer.report
			}

			const formData = new FormData()
			formData.append('action', 'save-scene-settings')
			formData.append('sceneId', currentSceneId || '')
			formData.append('userId', userId)
			formData.append('settings', JSON.stringify(currentSettings))
			formData.append('assetIds', JSON.stringify(assetIds))
			formData.append('gltfJson', JSON.stringify(gltfJsonToSend))

			// Include optimization report if available
			if (optimizationReport) {
				formData.append(
					'optimizationReport',
					JSON.stringify(optimizationReport)
				)
			}

			const response = await fetch('/api/scene-settings', {
				method: 'POST',
				body: formData
			})

			const result = await response.json()

			if (!response.ok || result.error) {
				throw new Error(
					result.error || `HTTP error! status: ${response.status}`
				)
			}

			const data = result.data || result

			if (data.unchanged) {
				return { unchanged: true }
			}

			return data
		} catch (error) {
			console.error('Failed to save scene settings:', error)
			throw error
		}
	}, [
		currentSceneId,
		userId,
		assetIds,
		currentSettings,
		serializeGltfDocument,
		optimizer
	])

	/**
	 * Load scene settings from database
	 */
	const loadSceneSettings = useCallback(async (targetSceneId: string) => {
		if (!targetSceneId) {
			throw new Error('No scene ID provided for loading settings')
		}

		try {
			const formData = new FormData()
			formData.append('action', 'get-scene-settings')
			formData.append('sceneId', targetSceneId)

			const response = await fetch('/api/scene-settings', {
				method: 'POST',
				body: formData
			})

			const result = await response.json()

			if (!response.ok || result.error) {
				throw new Error(
					result.error || `HTTP error! status: ${response.status}`
				)
			}

			return result.data || result
		} catch (error) {
			console.error('Failed to load scene settings:', error)
			throw error
		}
	}, [])

	/**
	 * Create a new version of scene settings
	 */
	const createNewVersion = useCallback(
		async (versionAssetIds: string[] = []) => {
			if (!currentSceneId || !userId) {
				throw new Error('Missing required parameters for creating new version')
			}

			try {
				const formData = new FormData()
				formData.append('action', 'create-version')
				formData.append('sceneId', currentSceneId)
				formData.append('userId', userId)
				formData.append('settingsData', JSON.stringify(currentSettings))
				if (versionAssetIds.length > 0) {
					formData.append('assetIds', JSON.stringify(versionAssetIds))
				}

				const response = await fetch('/api/scene-settings', {
					method: 'POST',
					body: formData
				})

				const result = await response.json()

				if (!response.ok || result.error) {
					throw new Error(
						result.error || `HTTP error! status: ${response.status}`
					)
				}

				return result.data || result
			} catch (error) {
				console.error('Failed to create new version:', error)
				throw error
			}
		},
		[currentSceneId, userId, currentSettings]
	)

	return {
		saveSceneSettings,
		loadSceneSettings,
		createNewVersion
	}
}
