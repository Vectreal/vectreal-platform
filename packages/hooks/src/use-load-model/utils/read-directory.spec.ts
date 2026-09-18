/**
 * Where a dropped folder's files came from.
 *
 * `getFile()` returns a `File` whose `webkitRelativePath` is the empty string -
 * that property is only ever filled in by an `<input webkitdirectory>` picker,
 * never by the File System Access API a drop goes through. Every consumer that
 * keyed a folder by path was therefore keying it by bare name alone, so two
 * files with one name in different subfolders silently became one.
 *
 * Mutation gates, executed: dropping the `withRelativePath` call reddens every
 * path case; starting the traversal at `''` instead of the folder's own name
 * reddens the two-folder case alone, which is how that defect presented.
 */
import { describe, expect, it } from 'vitest'

import readDirectory from './read-directory'

type Entry = [string, FakeFile | FakeDirectory]

interface FakeFile {
	kind: 'file'
	getFile: () => Promise<File>
}

interface FakeDirectory {
	kind: 'directory'
	/*
	  Named, because the name is part of every key. A fake without one cannot
	  observe whether the traversal uses it, so the assertions would hold either
	  way.
	*/
	name: string
	[Symbol.asyncIterator]: () => AsyncGenerator<Entry>
}

function directory(
	name: string,
	entries: Record<string, string | FakeDirectory>
): FakeDirectory {
	return {
		kind: 'directory',
		name,
		async *[Symbol.asyncIterator]() {
			for (const [child, value] of Object.entries(entries)) {
				yield typeof value === 'string'
					? [
							child,
							{ kind: 'file', getFile: async () => new File([value], child) }
						]
					: [child, value]
			}
		}
	}
}

const read = (root: FakeDirectory) =>
	readDirectory(root as unknown as FileSystemDirectoryHandle)

describe('a dropped folder remembers where each file sat in it', () => {
	it('records a nested file by its path under the folder that was dropped', async () => {
		const files = await read(
			directory('chair', {
				'chair.obj': 'o',
				textures: directory('textures', { 'wood.png': 'w' })
			})
		)

		expect(files.map((file) => file.webkitRelativePath).sort()).toEqual([
			'chair/chair.obj',
			'chair/textures/wood.png'
		])
	})

	it('keeps two files with one name apart', async () => {
		/*
		  The case that resolved to a single image. Both are `diffuse.png`, and
		  without the path there is nothing left to tell them apart - so one
		  material was textured with the other's image, and the conversion
		  reported success.
		*/
		const files = await read(
			directory('car', {
				body: directory('body', { 'diffuse.png': 'body' }),
				wheels: directory('wheels', { 'diffuse.png': 'wheels' })
			})
		)

		expect(files.map((file) => file.webkitRelativePath).sort()).toEqual([
			'car/body/diffuse.png',
			'car/wheels/diffuse.png'
		])
	})

	it('keeps two folders dropped in one gesture apart', async () => {
		/*
		  Two exports of one asset have the same layout, so a traversal starting
		  at the root of each wrote identical keys - and one key per file means
		  the second silently replaced the first, handing the model from the
		  first folder the second folder's material library.
		*/
		const a = await read(directory('chairA', { 'chair.obj': 'a' }))
		const b = await read(directory('chairB', { 'chair.obj': 'b' }))

		expect(a[0]?.webkitRelativePath).toBe('chairA/chair.obj')
		expect(b[0]?.webkitRelativePath).toBe('chairB/chair.obj')
	})

	it('leaves the file its own name, which is what the loader dispatches on', async () => {
		const files = await read(directory('chair', { 'chair.obj': 'o' }))

		expect(files[0]?.webkitRelativePath).toBe('chair/chair.obj')
		expect(files[0]?.name).toBe('chair.obj')
	})
})
