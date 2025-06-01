import { useThree } from '@react-three/fiber'
import { useCallback } from 'react'

function useSceneScreenshot() {
	const { gl, scene, camera } = useThree()

	const captureScreenshot = useCallback(() => {
		gl.render(scene, camera) // Ensure latest render
		const dataUrl = gl.domElement.toDataURL('image/png', 0.8) // Capture screenshot as JPEG
		// Save dataUrl with your scene data (e.g., send to backend)
		return dataUrl
	}, [gl, scene, camera])

	return captureScreenshot
}

export default useSceneScreenshot
