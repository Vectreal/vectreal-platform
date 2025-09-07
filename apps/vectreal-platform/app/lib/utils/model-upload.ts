/**
 * Utility functions for handling 3D model file uploads to Google Cloud Storage
 */

export interface ModelFileData {
	fileName: string
	fileContent: string // base64 encoded
	mimeType: string
	fileSize: number
}

/**
 * Convert a File object to base64-encoded string for API upload
 */
export async function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => {
			const result = reader.result as string
			// Remove the data URL prefix (e.g., "data:application/octet-stream;base64,")
			const base64 = result.split(',')[1]
			resolve(base64)
		}
		reader.onerror = reject
		reader.readAsDataURL(file)
	})
}

/**
 * Process a model file (gltf/glb) and its dependencies for upload
 */
export async function processModelForUpload(
	mainFile: File,
	additionalFiles: File[] = []
): Promise<{
	mainFile: ModelFileData
	additionalFiles: ModelFileData[]
}> {
	// Process main file
	const mainFileContent = await fileToBase64(mainFile)
	const mainFileData: ModelFileData = {
		fileName: mainFile.name,
		fileContent: mainFileContent,
		mimeType:
			mainFile.type ||
			(mainFile.name.endsWith('.gltf')
				? 'model/gltf+json'
				: 'model/gltf-binary'),
		fileSize: mainFile.size
	}

	// Process additional files (textures, bin files, etc.)
	const additionalFileData: ModelFileData[] = []
	for (const file of additionalFiles) {
		const fileContent = await fileToBase64(file)
		additionalFileData.push({
			fileName: file.name,
			fileContent,
			mimeType: file.type || 'application/octet-stream',
			fileSize: file.size
		})
	}

	return {
		mainFile: mainFileData,
		additionalFiles: additionalFileData
	}
}

/**
 * Extract files from a GLTF folder structure (when user uploads a folder)
 */
export function extractGltfFiles(files: File[]): {
	mainFile: File | null
	additionalFiles: File[]
} {
	let mainFile: File | null = null
	const additionalFiles: File[] = []

	for (const file of files) {
		const fileName = file.name.toLowerCase()

		if (fileName.endsWith('.gltf') || fileName.endsWith('.glb')) {
			mainFile = file
		} else if (
			fileName.endsWith('.bin') ||
			fileName.endsWith('.jpg') ||
			fileName.endsWith('.jpeg') ||
			fileName.endsWith('.png') ||
			fileName.endsWith('.webp') ||
			fileName.endsWith('.ktx2') ||
			fileName.endsWith('.basis')
		) {
			additionalFiles.push(file)
		}
	}

	return { mainFile, additionalFiles }
}

/**
 * Upload model files to the server
 */
export async function uploadModelToCloud(
	sceneId: string,
	mainFile: File,
	additionalFiles: File[] = []
) {
	// :
	//  Promise<{
	// 	success: boolean
	// 	uploadedAssets?: Array<{
	// 		id: string
	// 		fileName: string
	// 		filePath: string
	// 		publicUrl: string
	// 		assetType: string
	// 	}>
	// 	mainModelUrl?: string
	// 	error?: string
	// }>
	try {
		const { mainFile: mainFileData, additionalFiles: additionalFileData } =
			await processModelForUpload(mainFile, additionalFiles)

		const uploadRequest = {
			sceneId,
			mainFile: mainFileData,
			additionalFiles: additionalFileData
		}

		// const response = await fetch('/api/upload-model-assets', {
		// 	method: 'POST',
		// 	headers: {
		// 		'Content-Type': 'application/json'
		// 	},
		// 	body: JSON.stringify(uploadRequest)
		// })

		// if (!response.ok) {
		// 	const errorData = await response.json().catch(() => ({}))
		// 	throw new Error(errorData.error || `HTTP ${response.status}`)
		// }

		// const data = await response.json()
		// return {
		// 	success: true,
		// 	uploadedAssets: data.uploadedAssets,
		// 	mainModelUrl: data.mainModelUrl
		// }
	} catch (error) {
		console.error('Upload error:', error)
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Upload failed'
		}
	}
}
