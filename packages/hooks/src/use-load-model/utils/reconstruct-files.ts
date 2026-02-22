/* vectreal-core | vctrl/hooks
Copyright (C) 2024 Moritz Becker

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>. */

import type { InputFileOrDirectory, ServerSceneData } from '../types'

function decodeBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
	if (typeof atob !== 'function') {
		throw new Error('Base64 decoding is not supported in this environment')
	}

	const normalized = base64.replace(/\s/g, '')
	const binaryString = atob(normalized)
	const bytes = new Uint8Array(binaryString.length)

	for (let index = 0; index < binaryString.length; index += 1) {
		bytes[index] = binaryString.charCodeAt(index)
	}

	return bytes
}

/**
 * Reconstructs GLTF and asset files from scene data received from the server.
 *
 * This function converts the server's scene data format (GLTF JSON + binary assets)
 * back into File objects that can be loaded by the model loader. This is the reverse
 * operation of what happens when a scene is saved to the server.
 *
 * The function:
 * 1. Converts binary asset data (stored as number arrays) back into File objects
 * 2. Creates a GLTF file from the JSON structure
 * 3. Returns an array of files compatible with the model loading system
 *
 * @param data - Scene data from the server containing GLTF JSON and assets
 * @returns Array of File objects ready to be loaded (GLTF file + asset files)
 *
 * @example
 * ```typescript
 * // Load scene data from server
 * const sceneData = await ServerCommunicationService.loadScene('scene-123')
 *
 * // Reconstruct files
 * const files = reconstructGltfFiles(sceneData)
 *
 * // Load into the viewer
 * await modelLoader.load(files)
 * ```
 */
export function reconstructGltfFiles(
	data: ServerSceneData
): InputFileOrDirectory {
	const assetFiles: File[] = []

	// Convert asset data back to File objects
	if (data.assetData && typeof data.assetData === 'object') {
		for (const [, assetInfo] of Object.entries(data.assetData)) {
			const { data: assetData, fileName, mimeType, encoding } = assetInfo

			let uint8Array: Uint8Array<ArrayBuffer>

			if (typeof assetData === 'string') {
				if (encoding === 'base64') {
					uint8Array = decodeBase64ToUint8Array(assetData)
				} else {
					uint8Array = Uint8Array.from(new TextEncoder().encode(assetData))
				}
			} else {
				uint8Array = Uint8Array.from(assetData)
			}

			// Create a Blob from the binary data
			const blob = new Blob([uint8Array.buffer], { type: mimeType })

			// Create a File object
			const file = new File([blob], fileName, { type: mimeType })

			assetFiles.push(file)
		}
	}

	// Create GLTF file from JSON structure
	const gltfJsonString = JSON.stringify(data.gltfJson)
	const gltfBlob = new Blob([gltfJsonString], { type: 'model/gltf+json' })

	// Determine filename from metadata or use default
	const gltfFileName = data.meta?.sceneName
		? `${data.meta.sceneName}.gltf`
		: 'scene.gltf'

	const gltfFile = new File([gltfBlob], gltfFileName, {
		type: 'model/gltf+json'
	})

	// Return GLTF file first, followed by all asset files
	return [gltfFile, ...assetFiles]
}
