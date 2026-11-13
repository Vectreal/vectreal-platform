import { beforeEach, describe, expect, it, vi } from 'vitest'

import { deleteIntakeFolder } from './model-intake-storage.server'

/*
  An in-memory bucket that answers like Supabase Storage: `list` returns one
  level of a folder, one page at a time, with a subfolder as an entry whose id
  is null; `remove` deletes the paths it is given.
*/
const bucket = vi.hoisted(() => ({
	stored: new Set<string>(),
	removeCalls: [] as string[][],
	listCalls: [] as string[],
	listFails: false
}))
const { stored, removeCalls, listCalls } = bucket

const listLevel = vi.hoisted(
	() => (prefix: string, limit: number, offset: number) => {
		const children = new Map<string, string | null>()
		for (const path of bucket.stored) {
			if (!path.startsWith(`${prefix}/`)) continue
			const [name, ...rest] = path.slice(prefix.length + 1).split('/')
			children.set(name, rest.length > 0 ? null : `id-${path}`)
		}
		return [...children.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.slice(offset, offset + limit)
			.map(([name, id]) => ({ name, id }))
	}
)

vi.mock('@supabase/supabase-js', () => ({
	createClient: () => ({
		storage: {
			from: () => ({
				list: async (
					prefix: string,
					options: { limit: number; offset?: number }
				) =>
					bucket.listCalls.push(prefix) && bucket.listFails
						? { data: null, error: { message: 'storage down' } }
						: {
								data: listLevel(prefix, options.limit, options.offset ?? 0),
								error: null
							},
				remove: async (paths: string[]) => {
					bucket.removeCalls.push(paths)
					for (const path of paths) bucket.stored.delete(path)
					return { data: [], error: null }
				}
			})
		}
	})
}))

beforeEach(() => {
	process.env.SUPABASE_URL = 'http://storage.test'
	process.env.SUPABASE_SECRET_KEY = 'test'
	stored.clear()
	removeCalls.length = 0
	listCalls.length = 0
	bucket.listFails = false
})

describe('deleteIntakeFolder', () => {
	it('removes the photos, the attached files and anything deeper, and lists and removes only inside its own folder', async () => {
		for (const path of [
			'req-1/1.jpg',
			'req-1/2.jpg',
			'req-1/3.png',
			'req-1/files/lamp.step',
			'req-1/files/walkaround.mp4',
			'req-1/files/nested/extra.zip',
			'req-10/1.jpg',
			'req-2/files/other.zip'
		]) {
			stored.add(path)
		}

		await deleteIntakeFolder('req-1')

		expect([...stored].sort()).toEqual([
			'req-10/1.jpg',
			'req-2/files/other.zip'
		])
		// Storage lists a folder, not a name prefix, so these are what keep req-10 safe.
		expect(listCalls.sort()).toEqual([
			'req-1',
			'req-1/files',
			'req-1/files/nested'
		])
		expect(removeCalls.flat().every((path) => path.startsWith('req-1/'))).toBe(
			true
		)
	})

	it('walks every page of a large folder and removes in batches storage accepts', async () => {
		for (let n = 0; n < 2500; n++) stored.add(`req-1/files/part-${n}.zip`)
		stored.add('req-1/1.jpg')

		await deleteIntakeFolder('req-1')

		expect(stored.size).toBe(0)
		expect(removeCalls.every((paths) => paths.length <= 1000)).toBe(true)
	})

	it('throws when the folder cannot be listed, so the row stays for the next run', async () => {
		stored.add('req-1/1.jpg')
		bucket.listFails = true
		await expect(deleteIntakeFolder('req-1')).rejects.toThrow('storage down')
		expect(stored.has('req-1/1.jpg')).toBe(true)
	})
})
