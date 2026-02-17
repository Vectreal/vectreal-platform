/**
 * Recursively reads a directory
 *
 * @param directoryHandle - The directory handle to read
 * @returns - An array of file objects
 */
async function readDirectory(
	directoryHandle: FileSystemDirectoryHandle
): Promise<File[]> {
	const files: File[] = []

	async function* getFilesRecursively(
		entry: FileSystemDirectoryHandle
	): AsyncGenerator<File> {
		const asyncEntries = entry as unknown as AsyncIterable<
			[string, FileSystemHandle]
		>

		for await (const [, handle] of asyncEntries) {
			if (handle.kind === 'file') {
				yield await (handle as FileSystemFileHandle).getFile()
			} else if (handle.kind === 'directory') {
				yield* getFilesRecursively(handle as FileSystemDirectoryHandle)
			}
		}
	}

	for await (const file of getFilesRecursively(directoryHandle)) {
		files.push(file)
	}

	return files
}

export default readDirectory
