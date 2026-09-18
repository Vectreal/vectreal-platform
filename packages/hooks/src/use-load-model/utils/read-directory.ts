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
		entry: FileSystemDirectoryHandle,
		prefix: string
	): AsyncGenerator<File> {
		const asyncEntries = entry as unknown as AsyncIterable<
			[string, FileSystemHandle]
		>

		for await (const [name, handle] of asyncEntries) {
			if (handle.kind === 'file') {
				const file = await (handle as FileSystemFileHandle).getFile()
				yield withRelativePath(file, `${prefix}${name}`)
			} else if (handle.kind === 'directory') {
				yield* getFilesRecursively(
					handle as FileSystemDirectoryHandle,
					`${prefix}${name}/`
				)
			}
		}
	}

	/*
	  Prefixed with the dropped folder's own name, because more than one folder
	  can arrive in a single gesture. Starting every traversal at `''` made two
	  folders that share a layout - which is what two exports of the same asset
	  look like - write the same keys, and one file per key means the second
	  silently replaced the first: the model from the first folder rendered with
	  the second folder's material library, reported as success.

	  A material library refers to `textures/wood.png` and not
	  `chair/textures/wood.png`, so the key is deliberately longer than the
	  reference. Reconciling the two is `referenceKeyIn`'s job in
	  `@vctrl/core/model-loader`, which matches a reference against the tail of a
	  key for exactly this reason.
	*/
	for await (const file of getFilesRecursively(
		directoryHandle,
		`${directoryHandle.name}/`
	)) {
		files.push(file)
	}

	return files
}

/**
 * Records where in the dropped folder a file came from.
 *
 * `getFile()` hands back a `File` whose `webkitRelativePath` is the empty
 * string - that property is only ever populated by a `<input webkitdirectory>`
 * picker, never by the File System Access API a drop goes through. So every
 * consumer that keys a dropped folder by path was keying it by bare name alone,
 * and two files with one name in different subfolders collapsed onto each other
 * silently: an OBJ naming `body/diffuse.png` and `wheels/diffuse.png` got
 * whichever the traversal reached last, for both materials.
 *
 * The path includes the dropped folder's own name, so two folders dropped
 * together cannot write the same key. It is therefore longer than what a
 * material library refers to - an MTL beside the model writes
 * `textures/wood.png` - and `referenceKeyIn` closes that gap by matching a
 * reference against the tail of a key.
 *
 * `webkitRelativePath` is a prototype getter, so an own property on the
 * instance shadows it and every existing reader sees the path with no change.
 */
function withRelativePath(file: File, path: string): File {
	Object.defineProperty(file, 'webkitRelativePath', {
		value: path,
		configurable: true,
		enumerable: true
	})

	return file
}

export default readDirectory
