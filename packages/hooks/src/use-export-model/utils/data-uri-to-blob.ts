/**
 * Converts a data URI to a Blob.
 *
 * @param {string} dataURI - The data URI to convert.
 *
 * @returns {Blob} The Blob object.
 */
const dataURItoBlob = (dataURI: string): Blob => {
	const byteString = atob(dataURI.split(',')[1])
	const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]

	const ab = new ArrayBuffer(byteString.length)
	const ia = new Uint8Array(ab)

	for (let i = 0; i < byteString.length; i++) {
		ia[i] = byteString.charCodeAt(i)
	}

	return new Blob([ab], { type: mimeString })
}

export default dataURItoBlob
