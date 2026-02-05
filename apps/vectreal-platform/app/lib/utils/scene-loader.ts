import type { CameraProps, SceneMeta } from '@vctrl/core'
import type { ControlsProps, EnvironmentProps, ShadowsProps } from '@vctrl/core'
import type { InputFileOrDirectory } from '@vctrl/hooks/use-load-model'

export interface SceneData {
	gltfJson: Record<string, unknown>
	assetData: Record<
		string,
		{
			data: number[]
			fileName: string
			mimeType: string
		}
	>
	meta?: SceneMeta
	camera?: CameraProps
	environment?: EnvironmentProps
	controls?: ControlsProps
	shadows?: ShadowsProps
}

/**
 * Fetch scene data from the server
 */
export async function loadSceneFromServer(sceneId: string): Promise<SceneData> {
	const formData = new FormData()
	formData.append('action', 'get-scene-settings')
	formData.append('sceneId', sceneId)

	const response = await fetch('/api/scene-settings', {
		method: 'POST',
		body: formData
	})

	const result = await response.json()

	if (!response.ok || result.error) {
		throw new Error(result.error || `HTTP error! status: ${response.status}`)
	}

	return result.data || result
}

/**
 * Reconstruct GLTF and asset files from scene data
 */
export function reconstructGltfFiles(data: SceneData): InputFileOrDirectory {
	const assetFiles: File[] = []

	// Convert asset data to File objects
	if (data.assetData && typeof data.assetData === 'object') {
		for (const [, assetInfo] of Object.entries(data.assetData)) {
			const { data: assetData, fileName, mimeType } = assetInfo
			const uint8Array = new Uint8Array(assetData)
			const blob = new Blob([uint8Array], { type: mimeType })
			const file = new File([blob], fileName, { type: mimeType })
			assetFiles.push(file)
		}
	}

	// Create GLTF file
	const gltfJsonString = JSON.stringify(data.gltfJson)
	const gltfBlob = new Blob([gltfJsonString], { type: 'model/gltf+json' })
	const gltfFile = new File(
		[gltfBlob],
		`${data.meta?.sceneName || 'scene'}.gltf`,
		{ type: 'model/gltf+json' }
	)

	return [gltfFile, ...assetFiles]
}
