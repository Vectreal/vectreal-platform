// Helper function to convert ArrayBuffer to base64
async function arrayBufferToBase64(arrayBuffer: ArrayBuffer) {
	// Create a Blob from the ArrayBuffer
	const blob = new Blob([arrayBuffer])

	// Use the FileReader to convert the Blob to a Base64 string
	const reader = new FileReader()
	return new Promise((resolve, reject) => {
		reader.onloadend = () => {
			if (!reader?.result) return
			// Extract the Base64 string from the data URL
			const base64String = (reader?.result as string).split(',')[1]
			resolve(base64String)
		}
		reader.onerror = reject
		reader.readAsDataURL(blob)
	})
}

export default arrayBufferToBase64
