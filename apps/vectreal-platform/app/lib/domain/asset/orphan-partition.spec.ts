import { describe, expect, it } from 'vitest'

import { partitionOrphans, type OrphanAssetRow } from './orphan-partition'

const row = (
	id: string,
	filePath: string,
	fileSize: number | null = 10
): OrphanAssetRow => ({ id, filePath, fileSize })

describe('partitionOrphans', () => {
	it('classifies each disagreement in its own direction', () => {
		const live = row('live', 'scenes/a/assets/live/scene.gltf')
		const stranded = row('stranded', 'scenes/b/assets/stranded/scene.gltf', 25)
		const dangling = row('dangling', 'scenes/c/assets/dangling/scene.gltf')

		const result = partitionOrphans({
			allAssetRows: [live, stranded, dangling],
			unreferencedIds: new Set(['stranded']),
			storageObjectNames: new Set([
				live.filePath,
				stranded.filePath,
				// `dangling.filePath` is absent: the object is gone but a scene
				// still points at the row.
				'scenes/d/assets/ghost/orphan.bin'
			])
		})

		expect(result.unreferencedRows).toEqual([stranded])
		expect(result.danglingReferencedRows).toEqual([dangling])
		expect(result.storageOrphans).toEqual(['scenes/d/assets/ghost/orphan.bin'])
		expect(result.bytes.unreferenced).toBe(25)
	})

	it('does not call an object orphaned when a referenced row names it', () => {
		// The path belongs to a live asset. Deleting it would break that scene,
		// and no query would ever reveal what was removed.
		const live = row('live', 'scenes/a/assets/live/scene.gltf')

		const result = partitionOrphans({
			allAssetRows: [live],
			unreferencedIds: new Set(),
			storageObjectNames: new Set([live.filePath])
		})

		expect(result.storageOrphans).toEqual([])
		expect(result.unreferencedRows).toEqual([])
	})

	it('still reports a row whose object is already gone as collectable', () => {
		// Deleting the row is the point; the bytes are simply already absent.
		const stranded = row('stranded', 'scenes/b/assets/stranded/gone.bin', 7)

		const result = partitionOrphans({
			allAssetRows: [stranded],
			unreferencedIds: new Set(['stranded']),
			storageObjectNames: new Set()
		})

		expect(result.unreferencedRows).toEqual([stranded])
		expect(result.danglingReferencedRows).toEqual([])
		expect(result.bytes.unreferenced).toBe(7)
	})

	it('treats a null file size as zero rather than poisoning the total', () => {
		const result = partitionOrphans({
			allAssetRows: [row('a', 'p/a', null), row('b', 'p/b', 5)],
			unreferencedIds: new Set(['a', 'b']),
			storageObjectNames: new Set()
		})

		expect(result.bytes.unreferenced).toBe(5)
	})
})
