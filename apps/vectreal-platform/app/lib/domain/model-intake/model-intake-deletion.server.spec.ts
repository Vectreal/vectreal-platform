import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
	deleteIntakeById,
	purgeExpiredIntakes
} from './model-intake-deletion.server'

const { calls, rows, folders, storage } = vi.hoisted(() => {
	const calls: string[] = []
	return {
		calls,
		/** Requests with a row, and the request folders in the bucket. */
		rows: new Set<string>(),
		folders: new Set<string>(),
		storage: {
			deleteIntakeFolder: vi.fn(async (id: string) => {
				calls.push(`folder ${id}`)
			}),
			listIntakeFolderIds: async () => [] as string[]
		}
	}
})

vi.mock('./model-intake-storage.server', () => ({
	deleteIntakeFolder: (id: string) => storage.deleteIntakeFolder(id),
	listIntakeFolderIds: () => storage.listIntakeFolderIds()
}))
vi.mock('./model-intake-repository.server', () => ({
	selectExpiredIntakes: async () => [
		{ id: 'req-1', referenceCode: 'VCTR-1', photoPaths: [] }
	],
	deleteIntakeRow: async (id: string) => {
		calls.push(`row ${id}`)
		rows.delete(id)
	},
	findExistingIntakeIds: async (ids: string[]) =>
		new Set(ids.filter((id) => rows.has(id))),
	deleteExpiredIntakeLetters: async () => [],
	findIntakeForDeletion: async (id: string) =>
		id === 'req-1' ? { id, photoPaths: ['req-1/1.jpg'] } : null,
	findIntakeByReference: async () => null,
	selectExpiredIntakeLetters: async () => []
}))

beforeEach(() => {
	calls.length = 0
	storage.deleteIntakeFolder.mockClear()
	rows.clear()
	folders.clear()
	storage.listIntakeFolderIds = async () => [...folders]
})

describe('deleting a request', () => {
	it('the purge removes the whole folder, then the row', async () => {
		await purgeExpiredIntakes(new Date('2027-01-01'))
		expect(calls).toEqual(['folder req-1', 'row req-1'])
	})

	it('then sweeps a folder whose request is gone, and leaves a kept request alone', async () => {
		rows.add('req-1').add('req-2')
		folders.add('req-2').add('orphan-9')
		const purged = await purgeExpiredIntakes(new Date('2027-01-01'))
		expect(calls).toEqual(['folder req-1', 'row req-1', 'folder orphan-9'])
		expect(purged.orphans).toEqual(['orphan-9'])
	})

	it('a delete from the internal page does the same', async () => {
		expect(await deleteIntakeById('req-1')).toBe(true)
		expect(calls).toEqual(['folder req-1', 'row req-1'])
	})

	it('keeps the row when the folder cannot be removed, so the next run retries', async () => {
		storage.deleteIntakeFolder.mockRejectedValueOnce(new Error('storage down'))
		await expect(purgeExpiredIntakes(new Date('2027-01-01'))).rejects.toThrow(
			'storage down'
		)
		expect(calls).not.toContain('row req-1')
	})
})
