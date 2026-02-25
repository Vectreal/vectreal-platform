/**
 * Format the file size for display.
 *
 * @param bytes - The size in bytes.
 * @returns A human-readable file size string.
 */
export const formatFileSize = (bytes: number): string => {
	if (bytes >= 1024 * 1024) {
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
	} else if (bytes >= 1024) {
		return `${(bytes / 1024).toFixed(2)} KB`
	} else {
		return `${bytes} bytes`
	}
}
